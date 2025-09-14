// noinspection JSUnusedGlobalSymbols

import { createLogger } from "@/utils/logger";
import type { AuthInfo } from "@/workers/auth/types";
import { WordleEngine } from "@/workers/wordle/engine.ts";
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

	async getGameData( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> getGameData()" );
		return this.initializeEngine( input.gameId, authInfo.id )
			.then( data => ( { data: data.getPlayerData() } ) )
			.catch( error => {
				this.logger.error( "Error initializing engine:", error );
				return { error: ( error as Error ).message };
			} )
			.finally( () => this.logger.debug( "<< getGameData()" ) );
	}

	async createGame( input: CreateGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createGame()" );
		const engine = WordleEngine.create( input, authInfo.id, this.saveGameData );
		await engine.saveGameData();
		this.logger.debug( "<< createGame()" );
		return { data: engine.getPlayerData() };
	}

	async makeGuess( input: MakeGuessInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> makeGuess()" );
		return this.initializeEngine( input.gameId, authInfo.id )
			.then( async engine => {
				engine.makeGuess( input.guess );
				await engine.saveGameData();
				return { data: engine.getPlayerData() };
			} )
			.catch( error => {
				this.logger.error( "Error making a guess:", error );
				return { error: ( error as Error ).message };
			} )
			.finally( () => this.logger.debug( "<< makeGuess()" ) );
	}

	async getWords( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> getWords()" );
		return this.initializeEngine( input.gameId, authInfo.id )
			.then( data => ( { data: data.getWords() } ) )
			.catch( error => {
				this.logger.error( "Error initializing engine:", error );
				return { error: ( error as Error ).message };
			} )
			.finally( () => this.logger.debug( "<< getWords()" ) );

	}

	private async initializeEngine( gameId: string, playerId: string ) {
		const data = await this.loadGameData( gameId );
		if ( !data || data.playerId !== playerId ) {
			this.logger.error( "Game Not Found!" );
			throw "Game not found";
		}

		return new WordleEngine( data, this.saveGameData );
	}

	private async loadGameData( gameId: string ) {
		return this.env.WORDLE_KV.get( gameId )
			.then( d => !!d ? JSON.parse( d ) as GameData : undefined );
	}

	private async saveGameData( data: GameData ) {
		await this.env.WORDLE_KV.put( data.id, JSON.stringify( data ) );
	}
}