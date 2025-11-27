import { getCardFromId, isCardInHand } from "@s2h/cards/utils";
import { createLogger } from "@s2h/utils/logger";
import type { CallbreakEngine } from "./engine";
import type {
	BasePlayerInfo,
	CreateGameInput,
	DeclareDealWinsInput,
	GameId,
	JoinGameInput,
	PlayCardInput,
	PlayerGameInfo
} from "./types";
import { canCardBePlayed } from "./utils";

export class CallbreakService {

	private readonly logger = createLogger( "Callbreak:RPC" );

	constructor(
		private readonly engines: DurableObjectNamespace<CallbreakEngine>,
		private readonly kv: KVNamespace
	) {}

	public async createGame( input: CreateGameInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> createGame()" );

		const durableObjectId = this.engines.newUniqueId();
		const engine = this.engines.get( durableObjectId );
		const { code, gameId } = await engine.updateConfig( input, playerInfo.id );
		await engine.addPlayer( playerInfo );
		await this.saveDurableObjectId( { code, gameId, durableObjectId } );

		this.logger.debug( "<< createGame()" );
		return gameId;
	}

	public async joinGame( input: JoinGameInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> joinGame()" );

		const gameId = await this.getDurableObjectIdByCode( input.code );
		if ( !gameId ) {
			this.logger.debug( "Game not found for code %s!", input.code );
			throw "Game not found!";
		}

		const engine = await this.initializeEngine( gameId, playerInfo.id, async data => {
			this.validateJoinGame( playerInfo, data );
		} );

		await engine.addPlayer( playerInfo );

		this.logger.debug( "<< joinGame()" );
		return gameId;
	}

	public async getGameData( input: GameId, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> getGameData()" );

		const engine = await this.initializeEngine( input, playerInfo.id, async data => {
			if ( !data.players[ playerInfo.id ] ) {
				this.logger.error( "Player Not in Game: %s", playerInfo.id );
				throw "Player not in game!";
			}
		} );

		const { data } = await engine.getPlayerData( playerInfo.id );

		this.logger.debug( "<< getGameData()" );
		return data;
	}

	public async declareDealWins( input: DeclareDealWinsInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> declareDealWins()" );

		const engine = await this.initializeEngine( input.gameId, playerInfo.id, async data => {
			this.validateDealWinDeclaration( input, playerInfo, data );
		} );

		await engine.declareDealWins( input );

		this.logger.debug( "<< declareDealWins()" );
	}

	public async playCard( input: PlayCardInput, playerInfo: BasePlayerInfo ) {
		this.logger.debug( ">> playCard()" );

		const engine = await this.initializeEngine( input.gameId, playerInfo.id, async data => {
			this.validatePlayCard( input, playerInfo, data );
		} );

		await engine.playCard( input );

		this.logger.debug( "<< playCard()" );
	}

	/**
	 * Validates the join game request.
	 * Checks if the game exists, if the player is already in the game,
	 * and if the game is full.
	 * If any validation fails, it returns an error.
	 *
	 * @private
	 * @param {BasePlayerInfo} basePlayerInfo - The authentication information of the player.
	 * @param {PlayerGameInfo} data - The current game data.
	 */
	private validateJoinGame( basePlayerInfo: BasePlayerInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validateJoinGame()" );

		if ( data.players[ basePlayerInfo.id ] ) {
			this.logger.warn( "Already in Game: %s", basePlayerInfo.id );
			return;
		}

		if ( Object.keys( data.players ).length >= 4 ) {
			this.logger.error( "Game Full: %s", data.id );
			throw "Game full!";
		}

		this.logger.debug( "<< validateJoinGame()" );
	}

	/**
	 * Validates the declaration of deal wins.
	 * Checks if the deal exists, if it has no rounds,
	 * and if it's the player's turn.
	 * If any validation fails, it returns an error.
	 *
	 * @private
	 * @param {DeclareDealWinsInput} input - The input containing deal ID, wins and basePlayerInfo
	 * @param {BasePlayerInfo} basePlayerInfo - The authentication information of the player.
	 * @param {PlayerGameInfo} data - The current game data.
	 */
	private validateDealWinDeclaration(
		input: DeclareDealWinsInput,
		basePlayerInfo: BasePlayerInfo,
		data: PlayerGameInfo
	) {
		this.logger.debug( ">> validateDealWinDeclaration()" );

		if ( !data.players[ basePlayerInfo.id ] ) {
			this.logger.error( "Player Not in Game: %s", basePlayerInfo.id );
			throw "Player not in game!";
		}

		if ( data.currentTurn !== basePlayerInfo.id ) {
			this.logger.error( "Not Your Turn: %s", basePlayerInfo.id );
			throw "Not your turn!";
		}

		if ( !data.currentDeal || data.currentDeal.id !== input.dealId ) {
			this.logger.error( "Active Deal Not Found: %s", data.id );
			throw "Active deal not found!";
		}

		this.logger.debug( "<< validateDealWinDeclaration()" );
	}

	/**
	 * Validates the play card action.
	 * Checks if it's the player's turn, if the deal exists,
	 * if the round exists, if the card is in the player's hand,
	 * and if the card can be played according to the game rules.
	 * If any validation fails, it returns an error.
	 *
	 * @private
	 * @param {PlayCardInput} input - The input containing card ID, round ID, deal ID and basePlayerInfo
	 * @param {BasePlayerInfo} basePlayerInfo - The authentication information of the player.
	 * @param {PlayerGameInfo} data - The current game data.
	 */
	private validatePlayCard( input: PlayCardInput, basePlayerInfo: BasePlayerInfo, data: PlayerGameInfo ) {
		this.logger.debug( ">> validatePlayCard()" );

		const { currentRound, currentDeal, players, currentTurn, hand, trump } = data;

		if ( !players[ basePlayerInfo.id ] ) {
			this.logger.error( "Player Not in Game: %s", basePlayerInfo.id );
			throw "Player not in game!";
		}

		if ( currentTurn !== basePlayerInfo.id ) {
			this.logger.error( "Not Your Turn: %s", basePlayerInfo.id );
			throw "Not your turn!";
		}

		if ( !currentDeal || currentDeal.id !== input.dealId ) {
			this.logger.error( "Deal Not Found: %s", input.dealId );
			throw "Deal not found!";
		}

		if ( !currentRound || currentRound.id !== input.roundId ) {
			this.logger.error( "Round Not Found: %s", input.roundId );
			throw "Round not found!";
		}

		if ( !isCardInHand( hand, input.cardId ) ) {
			this.logger.error( "Card Not Yours: %s", input.cardId );
			throw "Card not in hand!";
		}

		const cardsPlayed = Object.values( currentRound.cards ).map( getCardFromId );
		const isCardPlayAllowed = canCardBePlayed( input.cardId, hand, trump, cardsPlayed, currentRound.suit );

		if ( !isCardPlayAllowed ) {
			this.logger.error( "Invalid Card: %s", input.cardId );
			throw "Card cannot be played!";
		}

		this.logger.debug( "<< validatePlayCard()" );
	}

	private async initializeEngine(
		gameId: string,
		playerId: string,
		runChecks?: ( data: PlayerGameInfo ) => Promise<void>
	) {
		const durableObjectId = await this.getDurableObjectIdByGameId( gameId );
		if ( !durableObjectId ) {
			this.logger.debug( "Game not found!" );
			throw "Game not found!";
		}

		const engine = this.engines.get( durableObjectId );
		const { data } = await engine.getPlayerData( playerId );

		if ( runChecks ) {
			runChecks( data ).catch( error => {
				this.logger.error( "Error during checks:", error );
				throw ( error as Error ).message;
			} );
		}

		return engine;
	}

	private async getDurableObjectIdByGameId( gameId: string ) {
		const id = await this.kv.get( `gameId:${ gameId }` );
		return !id ? undefined : this.engines.idFromString( id );
	}

	private async getDurableObjectIdByCode( code: string ) {
		return this.kv.get( `code:${ code }` );
	}

	private async saveDurableObjectId( data: { code: string, gameId: string, durableObjectId: DurableObjectId } ) {
		await this.kv.put( `code:${ data.code }`, data.durableObjectId.toString() );
		await this.kv.put( `gameId:${ data.gameId }`, data.durableObjectId.toString() );
	}
}