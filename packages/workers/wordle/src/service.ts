import { createLogger } from "@s2h/utils/logger";
import { WordleEngine } from "./engine";
import type { CreateGameInput, GameData, GameId, MakeGuessInput, PlayerGameInfo, PlayerId } from "./types";

export class WordleService {

	private readonly logger = createLogger( "Wordle:RPC" );

	constructor( private readonly kv: KVNamespace ) {}

	/**
	 * Create a new Wordle game
	 * @param input {CreateGameInput} - The input containing game options
	 * @param playerId {PlayerId} - The authenticated player's id
	 * @returns {Promise<PlayerGameInfo>} The created game information
	 */
	async createGame( input: CreateGameInput, playerId: PlayerId ): Promise<PlayerGameInfo> {
		this.logger.debug( ">> createGame()" );

		const engine = WordleEngine.create(
			{ wordLength: input.wordLength, wordCount: input.wordCount },
			playerId
		);

		await this.saveGameState( engine.getData() );

		this.logger.debug( "<< createGame()" );
		return engine.getPlayerData();
	}

	/**
	 * Get game state by game ID
	 * @param gameId {GameId} - The game id
	 * @param playerId {PlayerId} - The authenticated player's id
	 * @returns {Promise<PlayerGameInfo | null>} The game information or null if not found
	 */
	async getGame( gameId: GameId, playerId: PlayerId ): Promise<PlayerGameInfo | null> {
		this.logger.debug( ">> getGame()" );
		const engine = await this.initializeEngine( gameId, playerId );
		this.logger.debug( "<< getGame()" );
		return engine.getPlayerData();
	}

	/**
	 * Make a guess in the game
	 * @param input {MakeGuessInput} - The input containing gameId, playerId, and guess
	 * @param playerId {PlayerId} - The authenticated player's id
	 * @returns {Promise<PlayerGameInfo>} The updated game information
	 */
	async makeGuess( input: MakeGuessInput, playerId: PlayerId ): Promise<PlayerGameInfo> {
		this.logger.debug( ">> makeGuess()" );

		const engine = await this.initializeEngine( input.gameId, playerId );
		if ( engine.getData().completed ) {
			this.logger.error( "Game already completed:", input.gameId );
			throw "Game is already completed";
		}

		engine.makeGuess( input.guess );
		await this.saveGameState( engine.getData() );

		this.logger.info( "Guess made for game:", input.gameId );
		this.logger.debug( "<< makeGuess()" );
		return engine.getPlayerData();
	}

	/**
	 * Get the words for a completed game
	 * @param gameId {GameId} - The game id
	 * @param playerId {PlayerId} - The authenticated player's id
	 * @returns {Promise<string[]>} The words for the game
	 */
	async getWords( gameId: GameId, playerId: PlayerId ): Promise<string[]> {
		this.logger.debug( ">> getWords()" );
		const engine = await this.initializeEngine( gameId, playerId );
		const words = engine.getWords();
		this.logger.debug( "<< getWords()" );
		return words;
	}

	private async initializeEngine( gameId: GameId, playerId: PlayerId ) {
		const data = await this.loadGameState( gameId );
		if ( !data || data.playerId !== playerId ) {
			this.logger.error( "Game Not Found!" );
			throw "Game not found";
		}

		return new WordleEngine( data );
	}

	/**
	 * Load game state from KV storage
	 * @param gameId {string} - The game ID
	 * @returns {Promise<GameData | null>} The game data or null if not found
	 * @private
	 */
	private async loadGameState( gameId: string ): Promise<GameData | null> {
		this.logger.debug( ">> loadGameState()" );
		const gameData = await this.kv.get( gameId );
		this.logger.debug( "<< loadGameState()" );
		return !gameData ? null : JSON.parse( gameData );
	}

	/**
	 * Save game state to KV storage
	 * @param gameData {GameData} - The full game data to save (must include words)
	 * @returns {Promise<void>}
	 * @private
	 */
	private async saveGameState( gameData: GameData ): Promise<void> {
		this.logger.debug( ">> saveGameState()" );
		await this.kv.put( gameData.id, JSON.stringify( gameData ) );
		this.logger.debug( "<< saveGameState()" );
	}
}

