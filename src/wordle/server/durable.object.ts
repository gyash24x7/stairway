import type { AuthInfo } from "@/auth/types";
import { dictionary } from "@/libs/words/dictionary";
import { generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import type { Wordle } from "@/wordle/types";
import { DurableObject, env } from "cloudflare:workers";

export class WordleDurableObject extends DurableObject {

	private readonly logger = createLogger( "Wordle:DO" );
	private data: Wordle.Game | null = null;
	private readonly id: string;

	constructor( state: DurableObjectState, env: Env ) {
		super( state, env );
		this.id = state.id.toString();
		this.ctx.blockConcurrencyWhile( async () => {
			this.logger.debug( "Fetching game data from KV for GameId: %s", this.id );
			this.data = await env.WORDLE_KV.get( this.id ).then( d => d ? JSON.parse( d ) as Wordle.Game : null );
		} );
	}

	/**
	 * Creates a new Wordle game with the specified parameters.
	 * This method generates a random set of words based on the provided word count and length,
	 * and initializes the game state with the player's ID and the generated words.
	 * Defaults to 2 words of length 5 if not specified.
	 *
	 * @param {Wordle.CreateGameInput} input - The input parameters containing word count and length.
	 * @param {AuthInfo} authInfo - The authentication information of the player creating the game.
	 */
	async createGame( input: Wordle.CreateGameInput, { id: playerId }: AuthInfo ) {
		this.logger.debug( ">> createGame()" );

		const { wordCount = 2, wordLength = 5, gameId = generateId() } = input;
		const words: string[] = [];
		for ( let i = 0; i < wordCount; i++ ) {
			words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
		}

		this.data = { id: gameId, playerId, wordLength, wordCount, words, guesses: [], completedWords: [] };
		await this.saveGameData();

		this.logger.debug( "<< createGame()" );
	}

	/**
	 * Adds a guess to the game.
	 * @param {Wordle.MakeGuessInput} input - The input containing the guess word.
	 */
	async makeGuess( input: Wordle.MakeGuessInput ) {
		this.logger.debug( ">> makeGuess()" );

		if ( this.data ) {
			if ( !this.data.completedWords.includes( input.guess ) && this.data.words.includes( input.guess ) ) {
				this.data.completedWords.push( input.guess );
			}

			this.data.guesses.push( input.guess );
			await this.saveGameData();
		}

		this.logger.debug( "<< makeGuess()" );
	}

	/**
	 * Saves the game data for a specific game ID.
	 */
	private async saveGameData() {
		this.logger.debug( ">> saveGameData()" );
		if ( this.data ) {
			await env.WORDLE_KV.put( this.id, JSON.stringify( this.data ) );
			this.logger.debug( "Game data saved for GameId: %s", this.id );
		}
		this.logger.debug( "<< saveGameData()" );
	}
}
