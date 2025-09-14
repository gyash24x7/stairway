import { createLogger } from "@/utils/logger";
import type { AuthInfo } from "@/workers/auth/types";
import { CallbreakEngine } from "@/workers/callbreak/engine";
import type {
	CreateGameInput,
	DeclareDealWinsInput,
	GameData,
	GameIdInput,
	JoinGameInput,
	PlayCardInput,
	PlayerGameInfo
} from "@/workers/callbreak/types";
import { WorkerEntrypoint } from "cloudflare:workers";

export interface ICallbreakRPC extends WorkerEntrypoint {
	getGameData( input: GameIdInput, authInfo: AuthInfo ): Promise<DataResponse<PlayerGameInfo | undefined>>;

	createGame( input: CreateGameInput, authInfo: AuthInfo ): Promise<DataResponse<GameIdInput>>;

	joinGame( input: JoinGameInput, authInfo: AuthInfo ): Promise<DataResponse<GameIdInput>>;

	declareDealWins( input: DeclareDealWinsInput, authInfo: AuthInfo ): Promise<ErrorResponse>;

	playCard( input: PlayCardInput, authInfo: AuthInfo ): Promise<ErrorResponse>;
}

export default class CallbreakRPC extends WorkerEntrypoint<CallbreakWorkerEnv> implements ICallbreakRPC {

	private readonly logger = createLogger( "Callbreak:RPC" );

	async getGameData( input: GameIdInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> getGameData()" );
		return this.initializeEngine( input.gameId, authInfo.id )
			.then( engine => ( { data: engine.getPlayerData( authInfo.id ) } ) )
			.catch( error => {
				this.logger.error( "Error initializing engine:", error );
				return { error: ( error as Error ).message };
			} )
			.finally( () => this.logger.debug( "<< getGameData()" ) );
	}

	async createGame( input: CreateGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> createGame()" );
		const engine = CallbreakEngine.create( input, authInfo.id, this.saveGameData );
		await engine.saveGameData();
		this.logger.debug( "<< createGame()" );
		return { data: { gameId: engine.id } };
	}

	async joinGame( input: JoinGameInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> joinGame()" );

		const gameId = await this.env.KV.get( `code:${ input.code }` );
		if ( !gameId ) {
			this.logger.debug( "Game not found for code %s!", input.code );
			return { error: "Game not found!" };
		}

		return this.initializeEngine( gameId, authInfo.id )
			.then( async engine => {
				engine.addPlayer( authInfo );
				await engine.saveGameData();
				return { data: { gameId: engine.id } };
			} )
			.catch( error => {
				this.logger.error( "Error initializing engine:", error );
				return { error: ( error as Error ).message };
			} )
			.finally( () => this.logger.debug( "<< joinGame()" ) );
	}

	async declareDealWins( input: DeclareDealWinsInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> declareDealWins()" );
		return this.initializeEngine( input.gameId, authInfo.id )
			.then( async engine => {
				engine.declareDealWins( input, authInfo );
				await engine.saveGameData();
				return {};
			} )
			.catch( error => {
				this.logger.error( "Error declaring wins", error );
				return { error: ( error as Error ).message };
			} )
			.finally( () => this.logger.debug( "<< declareDealWins()" ) );
	}

	async playCard( input: PlayCardInput, authInfo: AuthInfo ) {
		this.logger.debug( ">> playCard()" );
		return this.initializeEngine( input.gameId, authInfo.id )
			.then( async engine => {
				engine.playCard( input, authInfo );
				await engine.saveGameData();
				return {};
			} )
			.catch( error => {
				this.logger.error( "Error playing card", error );
				return { error: ( error as Error ).message };
			} )
			.finally( () => this.logger.debug( "<< playCard()" ) );
	}

	private async initializeEngine( gameId: string, playerId: string ) {
		const data = await this.loadGameData( gameId );
		if ( !data || !data.players[ playerId ] ) {
			this.logger.error( "Game Not Found!" );
			throw "Game not found";
		}

		return new CallbreakEngine( data, this.saveGameData );
	}

	private async loadGameData( gameId: string ) {
		return this.env.KV.get( gameId )
			.then( d => !!d ? JSON.parse( d ) as GameData : undefined );
	}

	private async saveGameData( data: GameData ) {
		await this.env.KV.put( data.id, JSON.stringify( data ) );
	}
}