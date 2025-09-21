import type { AuthInfo } from "@/auth/types";
import type { CreateGameInput, DeclareDealWinsInput, GameData, PlayCardInput } from "@/callbreak/types";
import { CallbreakEngine } from "@/callbreak/worker/engine";
import { CARD_SUITS } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { DurableObject } from "cloudflare:workers";

export class CallbreakDO extends DurableObject {

	private readonly logger = createLogger( "Callbreak:DO" );
	private readonly key: string;
	private data: GameData;

	constructor( ctx: DurableObjectState, env: Env ) {
		super( ctx, env );
		this.key = ctx.id.toString();
		this.data = CallbreakEngine.create( { dealCount: 5, trumpSuit: CARD_SUITS.HEARTS } ).getData();

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
		const { deals, players, ...rest } = this.data;
		if ( !deals[ 0 ] ) {
			return { data: { ...rest, playerId, hand: [], players } };
		}

		const { rounds, hands, ...currentDeal } = deals[ 0 ];
		const currentRound = rounds[ 0 ];
		const data = { ...rest, playerId, currentDeal, currentRound, hand: hands[ playerId ] || [], players };

		this.logger.debug( "<< getPlayerData()" );
		return { data };
	}

	public async initialize( { authInfo, dealCount, trumpSuit }: Partial<CreateGameInput> & { authInfo: AuthInfo } ) {
		this.logger.debug( ">> initialize()" );
		const engine = new CallbreakEngine( this.data );
		engine.updateConfig( { dealCount, trumpSuit, playerId: authInfo.id } );
		engine.addPlayer( authInfo );
		this.data = engine.getData();
		await this.saveGameData();
		await this.setAlarm( 60000 );
		this.logger.debug( "<< initialize()" );
	}

	public async addPlayer( authInfo: AuthInfo ) {
		this.logger.debug( ">> addPlayer()" );
		const engine = new CallbreakEngine( this.data );
		engine.addPlayer( authInfo );
		this.data = engine.getData();
		await this.saveGameData();
		this.logger.debug( "<< addPlayer()" );
	}

	public async declareDealWins( input: DeclareDealWinsInput ) {
		this.logger.debug( ">> declareDealWins()" );
		const engine = new CallbreakEngine( this.data );
		engine.declareDealWins( input );
		this.data = engine.getData();
		await this.saveGameData();
		await this.setAlarm( 5000 );
		this.logger.debug( "<< declareDealWins()" );
	}

	public async playCard( input: PlayCardInput ) {
		this.logger.debug( ">> playCard()" );
		const engine = new CallbreakEngine( this.data );
		engine.playCard( input );
		this.data = engine.getData();
		await this.saveGameData();
		await this.setAlarm( 5000 );
		this.logger.debug( "<< playCard()" );
	}

	override async alarm() {
		this.logger.info( "Alarm triggered for gameId:", this.data.id );
		const engine = new CallbreakEngine( this.data );
		const setNextAlarm = engine.autoplay();
		this.data = engine.getData();
		await this.saveGameData();

		if ( setNextAlarm ) {
			await this.setAlarm( 5000 );
		}
	}

	private async setAlarm( ms: number ) {
		this.logger.info( "Setting alarm for gameId:", this.data.id, "in", ms, "ms" );
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.setAlarm( Date.now() + ms );
	}

	private async loadGameData() {
		return this.env.CALLBREAK_KV.get<GameData>( this.key, "json" );
	}

	private async saveGameData() {
		await this.env.CALLBREAK_KV.put( this.key, JSON.stringify( this.data ) );
	}
}