"use server";

import type {
	BaseGameConfig,
	BaseGameData,
	BasePlayerInfo,
	BasePlayerView,
	GameContext,
	GameData,
	GamePhase,
	GameStatus,
	GameStructure,
	MoveType,
	PlayerId,
	ReadonlyGameData
} from "@/shared/engine/types";
import { generateBotInfo } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { DurableObject } from "cloudflare:workers";

export abstract class AbstractGameEngine<
	G,
	M extends Record<string, unknown>,
	C extends BaseGameConfig,
	V extends BasePlayerView = BasePlayerView & G
> extends DurableObject {

	protected abstract readonly structure: GameStructure<G, M, C, V>;

	protected readonly logger = createLogger( "Game:Engine" );

	private context: GameContext = { turn: 0, players: [], currentPlayer: "" };
	private status: GameStatus = "CREATED";
	private players: Record<PlayerId, BasePlayerInfo> = {};

	private id = "";
	private code = "";
	private config = null as unknown as C;
	private state = null as unknown as G;

	constructor( ctx: DurableObjectState, env: Env ) {
		super( ctx, env );
		void this.ctx.blockConcurrencyWhile( async () => {
			await this.loadGameData();
		} );
	}

	public async initialize( gameId: string, code: string, config: C ) {
		this.logger.debug( ">> initialize()" );

		this.id = gameId;
		this.code = code;
		this.config = config;
		this.state = this.structure.setup( config );

		await this.saveGameData();

		this.logger.debug( "<< initialize()" );
	}

	public async join( player: BasePlayerInfo ) {
		this.logger.debug( ">> join()" );

		if ( !!this.players[ player.id ] ) {
			this.logger.warn( "Player already joined!" );
			return;
		}

		if ( this.isFull() ) {
			this.logger.error( "Game is already full!" );
			throw new Error( "Game is full." );
		}

		if ( this.context.players.length === 0 ) {
			this.context.currentPlayer = player.id;
		}

		this.players[ player.id ] = player;
		this.context.players.push( player.id );

		if ( this.structure.hooks?.onJoin ) {
			this.state = this.structure.hooks.onJoin( this.readonlyGameData(), player.id );
		}

		await this.saveGameData();
		await this.syncClients();

		if ( this.isFull() ) {
			if ( !this.config.autoStart ) {
				this.status = "PLAYERS_READY";
				await this.saveGameData();
				await this.syncClients();
			} else {
				await this.ctx.storage.put( "alarmType", "auto-start" );
				await this.ctx.storage.setAlarm( Date.now() + 5000 );
			}
		}

		this.logger.debug( "<< join()" );
	}

	public async start() {
		this.logger.debug( ">> start()" );

		if ( !this.isFull() ) {
			this.logger.error( "Not enough players to start the game!" );
			throw new Error( "Not enough players to start the game." );
		}

		if ( this.structure.hooks?.onStart ) {
			this.state = this.structure.hooks.onStart( this.readonlyGameData() );
		}

		if ( this.structure.phases ) {
			this.enterPhase( this.structure.initialPhase );
		}

		this.status = "IN_PROGRESS";

		await this.saveGameData();
		await this.syncClients();
		await this.scheduleBotIfNeeded();

		this.logger.debug( "<< start()" );
	}

	public async processMove<K extends keyof M>( playerId: string, moveType: K, input: M[K] ) {
		this.logger.debug( ">> processMove()" );

		this.executeMove( playerId, moveType, input );

		await this.saveGameData();
		await this.syncClients();
		await this.scheduleBotIfNeeded();

		this.logger.debug( "<< processMove()" );
	}

	public async addBots() {
		this.logger.debug( ">> addBots()" );

		const hasBotSupport = this.structure.botMove
			|| ( this.structure.phases && Object.values( this.structure.phases ).some( p => p.botMove ) );

		if ( !hasBotSupport ) {
			this.logger.error( "This game does not support bots!" );
			throw new Error( "This game does not support bots." );
		}

		const remaining = this.config.playerCount - Object.keys( this.players ).length;
		const bots = Array.from( { length: remaining }, () => generateBotInfo() );

		for ( const bot of bots ) {
			await this.join( bot );
		}

		this.logger.debug( "<< addBots()" );
	}

	public getGameData(): GameData<G, C> {
		return {
			config: this.config,
			state: this.state,
			players: this.players,
			status: this.status,
			context: this.context
		};
	}

	public getPlayerGameInfo( playerId: string ): BaseGameData & GameData<V, C> {
		const state = this.structure.playerView( this.readonlyGameData(), playerId );
		const data = this.getGameData();
		return { ...data, state, id: this.id, code: this.code };
	}

	override async alarm() {
		this.logger.debug( ">> alarm()" );

		const alarmType = await this.ctx.storage.get<string>( "alarmType" );
		await this.ctx.storage.delete( "alarmType" );

		if ( alarmType === "auto-start" ) {
			await this.start();
			this.logger.debug( "<< alarm()" );
			return;
		}

		const botMove = this.getBotMove();
		if ( !botMove ) {
			this.logger.debug( "<< alarm() [no bot move]" );
			return;
		}

		this.executeMove(
			this.context.currentPlayer,
			botMove.moveType,
			botMove.input
		);

		await this.saveGameData();
		await this.syncClients();
		await this.scheduleBotIfNeeded();

		this.logger.debug( "<< alarm()" );
	}

	private executeMove<T extends MoveType<M>>( playerId: string, moveType: T, input: M[T] ) {
		this.logger.debug( ">> executeMove()" );

		if ( this.status !== "IN_PROGRESS" && this.status !== "PLAYERS_READY" ) {
			this.logger.error( "Game is in invalid state!" );
			throw new Error( "Game is not in progress." );
		}

		if ( !this.players[ playerId ] ) {
			this.logger.error( "Player not in this game!" );
			throw new Error( "Player not in game." );
		}

		const phase = this.getCurrentPhase();
		const move = phase
			? phase.moves[ moveType as string ]
			: this.structure.moves?.[ moveType ];

		if ( !move ) {
			this.logger.error( "Invalid Move Type!" );
			throw new Error( "Invalid move type." );
		}

		if ( move.canMove ) {
			if ( !move.canMove( this.readonlyGameData(), playerId ) ) {
				this.logger.error( "Player cannot make this move!" );
				throw new Error( "You cannot make this move." );
			}
		} else if ( this.context.currentPlayer !== playerId ) {
			this.logger.error( "Not your turn!" );
			throw new Error( "Not your turn." );
		}

		if ( phase?.hooks?.beforeMove ) {
			this.state = phase.hooks.beforeMove( this.readonlyGameData(), playerId, moveType );
		}

		if ( this.structure.hooks?.beforeMove ) {
			this.state = this.structure.hooks.beforeMove( this.readonlyGameData(), playerId, moveType );
		}

		move.validate( this.readonlyGameData(), playerId, input );
		this.state = move.execute( this.readonlyGameData(), playerId, input );

		if ( phase?.hooks?.afterMove ) {
			this.state = phase.hooks.afterMove( this.readonlyGameData(), playerId, moveType );
		}
		if ( this.structure.hooks?.afterMove ) {
			this.state = this.structure.hooks.afterMove( this.readonlyGameData(), playerId, moveType );
		}

		this.context.turn++;

		if ( phase ) {
			const phaseEnded = phase.endIf( this.readonlyGameData() );
			if ( phaseEnded ) {
				const nextPhaseName = phase.resolveNextPhase( this.readonlyGameData() );
				this.transitionToPhase( nextPhaseName );
			} else {
				this.context.currentPlayer = phase.resolveNextPlayer(
					this.readonlyGameData(), playerId, moveType
				);
			}
		}

		const ended = this.structure.endIf( this.readonlyGameData() );
		if ( ended ) {
			if ( this.structure.hooks?.onEnd ) {
				this.state = this.structure.hooks.onEnd( this.readonlyGameData() );
			}
			this.status = "COMPLETED";
			this.logger.info( "Game completed!" );
		} else if ( !phase ) {
			this.context.currentPlayer = this.structure.resolveNextPlayer!(
				this.readonlyGameData(), playerId, moveType
			);
		}

		this.logger.debug( "<< executeMove()" );
	}

	private getBotMove(): { moveType: keyof M; input: M[keyof M] } | null {
		const phase = this.getCurrentPhase();
		const botMoveFn = phase?.botMove ?? this.structure.botMove;

		if ( !botMoveFn || this.status !== "IN_PROGRESS" ) {
			this.logger.warn( "No valid bot move!" );
			return null;
		}

		const playerId = this.context.currentPlayer;
		if ( !this.players[ playerId ]?.isBot ) {
			this.logger.warn( "Current player is not a bot!" );
			return null;
		}

		return botMoveFn( this.readonlyPlayerGameInfo( playerId ) ) as { moveType: keyof M; input: M[keyof M] };
	}

	private getCurrentPhase(): GamePhase<G, any, C> | null {
		if ( !this.structure.phases || !this.context.phase ) {
			return null;
		}
		return this.structure.phases[ this.context.phase ] ?? null;
	}

	private enterPhase( phaseName: string ) {
		const phase = this.structure.phases![ phaseName ];
		this.context.phase = phaseName;

		if ( phase.onEnter ) {
			this.state = phase.onEnter( this.readonlyGameData() );
		}

		if ( phase.resolveStartingPlayer ) {
			this.context.currentPlayer = phase.resolveStartingPlayer( this.readonlyGameData() );
		}
	}

	private transitionToPhase( phaseName: string ) {
		const currentPhase = this.getCurrentPhase();
		if ( currentPhase?.onExit ) {
			this.state = currentPhase.onExit( this.readonlyGameData() );
		}

		this.enterPhase( phaseName );
	}

	private isFull(): boolean {
		return Object.keys( this.players ).length >= this.config.playerCount;
	}

	private readonlyGameData(): ReadonlyGameData<G, C> {
		return {
			state: this.state,
			config: Object.freeze( { ...this.config } ),
			context: Object.freeze( { ...this.context } )
		};
	}

	private readonlyPlayerGameInfo( playerId: PlayerId ): ReadonlyGameData<V, C> {
		return {
			state: this.structure.playerView( this.readonlyGameData(), playerId ),
			config: Object.freeze( { ...this.config } ),
			context: Object.freeze( { ...this.context } )
		};
	}

	private async loadGameData() {
		const data = await this.ctx.storage.get<BaseGameData & GameData<G, C>>( "data" );
		if ( !data ) {
			return false;
		}

		this.id = data.id;
		this.code = data.code;
		this.players = data.players;
		this.state = data.state;
		this.status = data.status;
		this.config = data.config;
		this.context = data.context;

		return true;
	}

	private async saveGameData() {
		await this.ctx.storage.put( "data", {
			...this.getGameData(),
			id: this.id,
			code: this.code
		} );
	}

	private async syncClients() {
		for ( const playerId of Object.keys( this.players ).filter( id => !this.players[ id ].isBot ) ) {
			const data = this.getPlayerGameInfo( playerId );

			const syncId = this.env.SYNCED_STATE_SERVER.idFromName( `${ this.structure.name }:${ playerId }` );
			const syncStub = this.env.SYNCED_STATE_SERVER.get( syncId );

			await syncStub.setState( data, data.id );
		}
	}

	private async scheduleBotIfNeeded() {
		const isNextPlayerBot = !!this.players[ this.context.currentPlayer ]?.isBot;
		if ( this.status === "IN_PROGRESS" && isNextPlayerBot ) {
			await this.ctx.storage.setAlarm( Date.now() + 5000 );
		}
	}
}
