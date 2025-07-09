import type { AuthInfo } from "@/auth/types";
import { dictionary } from "@/libs/words/dictionary";
import { generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import type { Wordle } from "@/wordle/types";
import { DurableObject } from "cloudflare:workers";

export class WordleDurableObject extends DurableObject {

	private readonly logger = createLogger( "Wordle:DO" );
	private readonly state: DurableObjectState;

	constructor( state: DurableObjectState, env: Env ) {
		super( state, env );
		this.state = state;
	}

	async getGameData( gameId: string ) {
		this.logger.debug( ">> getGameData()" );
		const game = await this.state.storage.get<Wordle.Game>( gameId );
		this.logger.debug( "<< getGameData()" );
		return game;
	}

	async saveGameData( gameId: string, game: Wordle.Game ) {
		this.logger.debug( ">> saveGameData()" );
		await this.state.storage.put( gameId, game );
		this.logger.debug( "<< saveGameData()" );
		return game;
	}

	async createGame( { wordCount = 2, wordLength = 5 }: Wordle.CreateGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createGame()" );

		const words: string[] = [];
		for ( let i = 0; i < wordCount; i++ ) {
			words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
		}

		const game = {
			id: generateId(),
			playerId: authInfo.id,
			words,
			wordLength,
			wordCount,
			guesses: [],
			completedWords: []
		};

		this.logger.debug( "<< createGame()" );
		return game;
	}

	async makeGuess( input: Wordle.MakeGuessInput, playerId: string ) {
		this.logger.debug( ">> makeGuess()" );

		const game = await this.getGameData( input.gameId );
		if ( !game || game.playerId !== playerId ) {
			this.logger.error( "Game Not Found!" );
			throw "Game not found!";
		}

		if ( game.guesses.length >= game.wordLength + game.wordCount ) {
			this.logger.error( "No More Guesses Left! GameId: %s", game.id );
			throw "No More Guesses Left!";
		}

		if ( !dictionary.includes( input.guess ) ) {
			this.logger.error( "The guess is not a valid word! GameId: %s", game.id );
			throw "The guess is not a valid word!";
		}

		if ( !game.completedWords.includes( input.guess ) && game.words.includes( input.guess ) ) {
			game.completedWords.push( input.guess );
		}

		game.guesses.push( input.guess );
		await this.state.storage.put( input.gameId, game );

		this.logger.debug( "<< makeGuess()" );
		return game;
	}
}
