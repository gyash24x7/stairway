import { createLogger } from "@/utils/logger";
import type { AuthInfo } from "@/workers/auth/types";
import { dictionary } from "@/workers/wordle/dictionary";
import { engine } from "@/workers/wordle/engine";
import type { CreateGameInput, GameData, GameIdInput, MakeGuessInput, PlayerGameInfo } from "@/workers/wordle/types";
import { WorkerEntrypoint } from "cloudflare:workers";

export interface IWordleRPC extends WorkerEntrypoint {
	getGameData( input: GameIdInput, authInfo: AuthInfo ): Promise<DataResponse<PlayerGameInfo | undefined>>;

	createGame( input: CreateGameInput, authInfo: AuthInfo ): Promise<DataResponse<PlayerGameInfo>>;

	makeGuess( input: MakeGuessInput, authInfo: AuthInfo ): Promise<DataResponse<PlayerGameInfo>>;

	getWords( input: GameIdInput, authInfo: AuthInfo ): Promise<DataResponse<string[]>>;
}

export default class WordleRPC extends WorkerEntrypoint<WordleWorkerEnv> implements IWordleRPC {

	private readonly logger = createLogger( "Wordle:RPC" );

	constructor( ctx: ExecutionContext, env: WordleWorkerEnv ) {
		super( ctx, env );
	}

	async getGameData( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> getGameData()" );

		const data = await this.loadGameData( input.gameId );
		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error };
		}

		const { words, ...rest } = data;
		this.logger.debug( "<< getGameData()" );
		return { data: rest };
	}

	async createGame( input: CreateGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createGame()" );
		const data = engine.createGame( input, authInfo.id );
		await this.saveGameData( data );
		this.logger.debug( "<< createGame()" );
		const { words, ...rest } = data;
		return { data: rest };
	}

	async makeGuess( input: MakeGuessInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> makeGuess()" );

		const data = await this.loadGameData( input.gameId );
		const { error } = this.validateMakeGuess( input, authInfo, data );
		if ( error || !data ) {
			return { error: error ?? "Invalid Game!" };
		}

		const updatedData = engine.makeGuess( input.guess, data );
		await this.saveGameData( updatedData );

		this.logger.debug( "<< makeGuess()" );
		const { words, ...rest } = updatedData;
		return { data: rest };
	}

	async getWords( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> getWords()" );

		const data = await this.loadGameData( input.gameId );
		const { error } = this.validateGetWords( authInfo, data );
		if ( error || !data ) {
			return { error };
		}

		this.logger.debug( "<< getWords()" );
		return { data: data.words };
	}

	private validateGameData( authInfo: AuthInfo, data?: GameData ) {
		if ( !data || data.playerId !== authInfo.id ) {
			this.logger.error( "Game Not Found!" );
			return { error: "Game not found" };
		}

		return {};
	}

	private validateGetWords( authInfo: AuthInfo, data?: GameData ) {
		this.logger.debug( ">> validateGetWords()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error };
		}

		if ( !data.completed ) {
			this.logger.error( "Cannot show words before completion! GameId: %s", data.id );
			return { error: "Cannot show words before completion!" };
		}

		this.logger.debug( "<< validateGetWords()" );
		return {};
	}

	private validateMakeGuess( input: MakeGuessInput, authInfo: AuthInfo, data?: GameData ) {
		this.logger.debug( ">> validateMakeGuess()" );

		const { error } = this.validateGameData( authInfo, data );
		if ( error || !data ) {
			return { error };
		}

		if ( data.guesses.length >= data.wordLength + data.wordCount ) {
			this.logger.error( "No More Guesses Left! GameId: %s", data.id );
			return { error: "No more guesses left" };
		}

		if ( !dictionary.includes( input.guess ) ) {
			this.logger.error( "The guess is not a valid word! GameId: %s", data.id );
			return { error: "The guess is not a valid word" };
		}

		return {};
	}

	private async loadGameData( gameId: string ) {
		return this.env.WORDLE_KV.get( gameId )
			.then( d => !!d ? JSON.parse( d ) as GameData : undefined );
	}

	private async saveGameData( data: GameData ) {
		await this.env.WORDLE_KV.put( data.id, JSON.stringify( data ) );
	}
}