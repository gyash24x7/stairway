import type { AuthInfo } from "@/auth/types";
import type {
	AskEventInput,
	ClaimEventInput,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	PlayerGameInfo,
	StartGameInput,
	TransferEventInput
} from "@/fish/types";
import { FishEngine } from "@/fish/worker/engine";
import { getCardFromId } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { DurableObject } from "cloudflare:workers";

export class FishDO extends DurableObject {

	private readonly logger = createLogger( "Fish:DO" );
	private readonly key: string;
	private data: GameData;

	constructor( ctx: DurableObjectState, env: Env ) {
		super( ctx, env );
		this.key = ctx.id.toString();
		this.data = FishEngine.create( {} ).getData();

		ctx.blockConcurrencyWhile( async () => {
			const data = await this.loadGameData();
			if ( data ) {
				this.data = data;
			} else {
				this.logger.info( "No existing game data found, starting new game." );
				await this.saveGameData();
			}
		} );
	}

	public async getPlayerData( playerId: string ) {
		this.logger.debug( ">> getPlayerData()" );
		const playerDataMap = this.getPlayerDataMap();
		const data = playerDataMap[ playerId ];
		this.logger.debug( "<< getPlayerData()" );
		return { data };
	}

	public async initialize( { playerCount, authInfo }: Partial<CreateGameInput> & { authInfo: AuthInfo } ) {
		this.logger.debug( ">> initialize()" );
		const engine = new FishEngine( this.data );
		engine.updateConfig( { playerCount, playerId: authInfo.id } );
		engine.addPlayer( authInfo );
		this.data = engine.getData();
		await this.saveGameData();
		await this.setAlarm( 60000 );
		this.logger.debug( "<< initialize()" );
	}

	public async addPlayer( authInfo: AuthInfo ) {
		this.logger.debug( ">> addPlayer()" );
		const engine = new FishEngine( this.data );
		engine.addPlayer( authInfo );
		this.data = engine.getData();
		await this.saveGameData();
		await this.broadcastGameData();
		this.logger.debug( "<< addPlayer()" );
	}

	public async createTeams( input: CreateTeamsInput ) {
		this.logger.debug( ">> createTeams()" );
		const engine = new FishEngine( this.data );
		engine.createTeams( input );
		this.data = engine.getData();
		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );
		this.logger.debug( "<< createTeams()" );
	}

	public async startGame( input: StartGameInput ) {
		this.logger.debug( ">> startGame()" );
		const engine = new FishEngine( this.data );
		engine.startGame( input );
		this.data = engine.getData();
		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );
		this.logger.debug( "<< startGame()" );
	}

	public async handleAskEvent( input: AskEventInput ) {
		this.logger.debug( ">> handleAskEvent()" );
		const engine = new FishEngine( this.data );
		engine.handleAskEvent( input );
		this.data = engine.getData();
		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );
		this.logger.debug( "<< handleAskEvent()" );
	}

	public async handleClaimEvent( input: ClaimEventInput ) {
		this.logger.debug( ">> handleClaimEvent()" );
		const engine = new FishEngine( this.data );
		engine.handleClaimEvent( input );
		this.data = engine.getData();
		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );
		this.logger.debug( "<< handleClaimEvent()" );
	}

	public async handleTransferEvent( input: TransferEventInput ) {
		this.logger.debug( ">> handleTransferEvent()" );
		const engine = new FishEngine( this.data );
		engine.handleTransferEvent( input );
		this.data = engine.getData();
		await this.saveGameData();
		await this.broadcastGameData();
		await this.setAlarm( 5000 );
		this.logger.debug( "<< handleTransferEvent()" );
	}

	override async alarm() {
		this.logger.info( "Alarm triggered for gameId:", this.data.id );
		const engine = new FishEngine( this.data );
		const setNextAlarm = engine.autoplay();
		this.data = engine.getData();
		await this.saveGameData();
		await this.broadcastGameData();

		if ( setNextAlarm ) {
			await this.setAlarm( 5000 );
		}
	}

	private getPlayerDataMap() {
		const { hands, cardMappings, ...rest } = this.data;
		return Object.keys( this.data.players ).reduce(
			( acc, playerId ) => {
				acc[ playerId ] = { ...rest, playerId, hand: hands[ playerId ]?.map( getCardFromId ) || [] };
				return acc;
			},
			{} as Record<string, PlayerGameInfo>
		);
	}

	private async broadcastGameData() {
		await this.env.WS_DO.getByName( `fish:${ this.data.id }` ).broadcast( this.getPlayerDataMap() );
	}

	private async setAlarm( ms: number ) {
		this.logger.info( "Setting alarm for gameId:", this.data.id, "in", ms, "ms" );
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.setAlarm( Date.now() + ms );
	}

	private async loadGameData() {
		return this.env.FISH_KV.get<GameData>( this.key, "json" );
	}

	private async saveGameData() {
		await this.env.FISH_KV.put( this.key, JSON.stringify( this.data ) );
	}
}