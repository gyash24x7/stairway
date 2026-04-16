import type {
	BaseGameConfig,
	BasePlayerInfo,
	GameContext,
	GameData,
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
	V = G
> extends DurableObject {

	protected abstract readonly structure: GameStructure<G, M, C, V>;

	protected readonly logger = createLogger( "Game:Engine" );
	private readonly connections = new Map<WebSocket, { userId: string }>();

	private config: C;
	private state: G;
	private context: GameContext = { turn: 0, players: [], currentPlayer: "" };
	private status: GameStatus = "CREATED";
	private players: Record<PlayerId, BasePlayerInfo> = {};

	constructor( ctx: DurableObjectState, env: Env ) {
		super( ctx, env );

		const initialState = this.getInitialState();
		this.state = initialState.state;
		this.config = initialState.config;

		this.ctx.blockConcurrencyWhile( async () => {
			const loaded = await this.loadGameData();
			if ( !loaded ) {
				await this.saveGameData();
			}
		} );

		this.ctx.getWebSockets().forEach( ( ws ) => {
			const attachment = ws.deserializeAttachment();
			if ( attachment ) {
				this.connections.set( ws, { ...attachment } );
			}
		} );

		const wsResponsePair = new WebSocketRequestResponsePair( "ping", "pong" );
		this.ctx.setWebSocketAutoResponse( wsResponsePair );
	}

	public async initialize( config: C ) {
		this.logger.debug( ">> initialize()" );

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
			if ( this.config.autoStart === false ) {
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

		this.context.currentPlayer = this.resolveNextPlayer();
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

		if ( !this.structure.botMove ) {
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

	public getPlayerGameInfo( playerId: string ): GameData<V, C> {
		const state = this.structure.playerView( this.readonlyGameData(), playerId );
		const data = this.getGameData();
		return { ...data, state };
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

	override async fetch( request: Request ) {
		this.logger.debug( ">> fetch()" );

		const userId = request.headers.get( "X-User-Id" );
		if ( !userId ) {
			this.logger.warn( "Unauthorized WebSocket connection attempt." );
			return new Response( "Unauthorized", { status: 401 } );
		}

		const webSocketPair = new WebSocketPair();
		const [ client, server ] = Object.values( webSocketPair );
		this.ctx.acceptWebSocket( server );

		server.serializeAttachment( { userId } );
		this.connections.set( server, { userId } );

		this.logger.debug( `User ${ userId } connected.` );
		this.logger.debug( "<< fetch()" );
		return new Response( null, { status: 101, webSocket: client } );
	}

	override async webSocketClose( ws: WebSocket, code: number, reason: string ) {
		ws.close( code, reason ?? "Closed by DO!" );
		this.connections.delete( ws );
		this.logger.debug( "Connection closed!", code, reason );
	}

	// ── Game logic (inlined from GameEngine) ──────────────────────────────

	protected abstract getInitialState(): { state: G, config: C };

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

		if ( this.context.currentPlayer !== playerId ) {
			this.logger.error( "Not your turn!" );
			throw new Error( "Not your turn." );
		}

		const move = this.structure.moves[ moveType ];
		if ( !move ) {
			this.logger.error( "Invalid Move Type!" );
			throw new Error( "Invalid move type." );
		}

		if ( this.structure.hooks?.beforeMove ) {
			this.state = this.structure.hooks.beforeMove( this.readonlyGameData(), playerId, moveType );
		}

		move.validate( this.readonlyGameData(), playerId, input );
		this.state = move.execute( this.readonlyGameData(), playerId, input );

		if ( this.structure.hooks?.afterMove ) {
			this.state = this.structure.hooks.afterMove( this.readonlyGameData(), playerId, moveType );
		}

		this.context.currentPlayer = this.resolveNextPlayer();

		const ended = this.structure.endIf( this.readonlyGameData() );
		if ( ended ) {
			if ( this.structure.hooks?.onEnd ) {
				this.state = this.structure.hooks.onEnd( this.readonlyGameData() );
			}

			this.status = "COMPLETED";
			this.logger.info( "Game completed!" );
		}

		this.logger.debug( "<< executeMove()" );
	}

	private getBotMove(): { moveType: keyof M; input: M[keyof M] } | null {
		if ( !this.structure.botMove || this.status !== "IN_PROGRESS" ) {
			this.logger.warn( "No valid bot move!" );
			return null;
		}

		const playerId = this.context.currentPlayer;
		if ( !this.players[ playerId ]?.isBot ) {
			this.logger.warn( "Current player is not a bot!" );
			return null;
		}

		return this.structure.botMove( this.readonlyPlayerGameInfo( playerId ) );
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

	private resolveNextPlayer(): PlayerId {
		this.context.turn++;

		const { getNextPlayer } = this.structure;

		if ( getNextPlayer === "round-robin" ) {
			const index = this.context.turn % this.context.players.length;
			return this.context.players[ index ];
		}

		return getNextPlayer( this.state, this.context );
	}

	// ── Storage & sync ────────────────────────────────────────────────────

	private async loadGameData() {
		const data = await this.ctx.storage.get<GameData<G, C>>( "data" );
		if ( !data ) {
			return false;
		}

		this.players = data.players;
		this.state = data.state;
		this.status = data.status;
		this.config = data.config;
		this.context = data.context;

		return true;
	}

	private async saveGameData() {
		await this.ctx.storage.put( "data", this.getGameData() );
	}

	private async syncClients() {
		for ( const playerId of Object.keys( this.players ).filter( id => !this.players[ id ].isBot ) ) {
			const data = this.getPlayerGameInfo( playerId );
			const [ ws ] = this.connections.entries()
				.filter( ( [ _ws, meta ] ) => meta.userId === playerId && _ws.readyState === WebSocket.OPEN )
				.map( ( [ ws ] ) => ws );

			if ( ws ) {
				ws.send( JSON.stringify( { data } ) );
			}
		}
	}

	private async scheduleBotIfNeeded() {
		const isNextPlayerBot = !!this.players[ this.context.currentPlayer ]?.isBot;
		if ( this.status === "IN_PROGRESS" && isNextPlayerBot ) {
			await this.ctx.storage.setAlarm( Date.now() + 5000 );
		}
	}
}
