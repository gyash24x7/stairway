"use server";

import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
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
	PlayerGameData,
	PlayerId,
	ReadonlyGameData,
	SharedGameData
} from "@/shared/engine/types";
import { generateBotInfo } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { DurableObject } from "cloudflare:workers";
import { eq } from "drizzle-orm";

/**
 * Abstract base class for all game engines in the platform.
 * Implemented as a Cloudflare Durable Object that persists game state via `ctx.storage`,
 * manages player lifecycle, executes validated moves, supports phased game structures,
 * and schedules bot moves via alarms.
 */
export abstract class AbstractGameEngine<
	G,
	M extends Record<string, unknown>,
	C extends BaseGameConfig,
	SV = G,
	PV extends BasePlayerView = BasePlayerView
> extends DurableObject {

	protected readonly logger = createLogger( "Game:Engine" );

	protected abstract readonly structure: GameStructure<G, M, C, SV, PV>;

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

	/**
	 * Initializes a new game with the given ID, join code, and configuration.
	 * Sets up the initial game state using the structure's setup function.
	 * @param gameId - The unique identifier for this game instance.
	 * @param code - The short join code players use to connect to the game.
	 * @param config - The game-specific configuration options.
	 */
	public async initialize( gameId: string, code: string, config: C ) {
		this.logger.debug( ">> initialize()" );

		this.id = gameId;
		this.code = code;
		this.config = config;
		this.state = this.structure.setup( config );

		await this.saveGameData();

		this.logger.debug( "<< initialize()" );
	}

	/**
	 * Handles a player joining the game.
	 * Validates the player is not already in the game and that the game is not full.
	 * Triggers the onJoin hook if defined, and auto-starts the game if configured.
	 * @param player - The player information for the joining player.
	 */
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

	/**
	 * Starts the game once all players have joined.
	 * Triggers the onStart hook, enters the initial phase if using phased structure,
	 * sets the game status to IN_PROGRESS, and schedules a bot move if needed.
	 */
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

	/**
	 * Processes a player's move by executing it, persisting state, and syncing clients.
	 * @param playerId - The ID of the player making the move.
	 * @param moveType - The type of move being made.
	 * @param input - The move-specific input data.
	 */
	public async processMove<K extends keyof M>( playerId: string, moveType: K, input: M[K] ) {
		this.logger.debug( ">> processMove()" );

		this.executeMove( playerId, moveType, input );

		await this.saveGameData();
		await this.syncClients();

		if ( this.status === "COMPLETED" ) {
			await this.archive();
		} else {
			await this.scheduleBotIfNeeded();
		}

		this.logger.debug( "<< processMove()" );
	}

	/**
	 * Fills remaining player slots with bot players.
	 * Throws if the game structure does not support bots.
	 */
	public async addBots() {
		this.logger.debug( ">> addBots()" );

		const hasBotSupport = this.structure.botMove ||
			( this.structure.phases && Object.values( this.structure.phases ).some( p => p.botMove ) );

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

	/**
	 * Returns game data split into shared state and player-specific state.
	 * @param playerId - The ID of the player requesting the view.
	 * @returns An object with `shared` (common game data) and `player` (player-specific data).
	 */
	public getPlayerGameInfo( playerId: string ): {
		shared: SharedGameData<SV, C>;
		player: PlayerGameData<PV>
	} {
		return {
			shared: this.getSharedGameInfo(),
			player: this.getPlayerSpecificInfo( playerId )
		};
	}

	/**
	 * Durable Object alarm handler for bot moves and auto-start.
	 * Reads the alarm type from storage to determine whether to auto-start the game
	 * or execute a bot's move.
	 */
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

		if ( this.status === "COMPLETED" ) {
			await this.archive();
		} else {
			await this.scheduleBotIfNeeded();
		}

		this.logger.debug( "<< alarm()" );
	}

	/**
	 * Type safe utilitu to create game structure in sub classes
	 * @param structure game structure
	 * @protected
	 */
	protected defineStructure( structure: GameStructure<G, M, C, SV, PV> ) {
		return structure;
	}

	/**
	 * Type-safe helper to define a game phase with inferred move input types.
	 * @param phase game phase definition
	 * @protected
	 */
	protected definePhase<PM extends Partial<M>>( phase: GamePhase<G, PM, C, SV, PV> ) {
		return phase;
	}

	/**
	 * Utitlity for other engines to use and implement game specific features.
	 * @protected
	 */
	protected getGameData() {
		return {
			id: this.id,
			code: this.code,
			config: this.config,
			state: this.state,
			players: this.players,
			status: this.status,
			context: this.context
		};
	}

	/**
	 * Returns the shared game data visible to all players.
	 */
	private getSharedGameInfo(): SharedGameData<SV, C> {
		return {
			id: this.id,
			code: this.code,
			config: this.config,
			state: this.structure.sharedView( this.readonlyGameData() ),
			players: this.players,
			status: this.status,
			context: this.context
		};
	}

	/**
	 * Returns the player-specific game data.
	 */
	private getPlayerSpecificInfo( playerId: PlayerId ): PlayerGameData<PV> {
		return this.structure.playerView( this.readonlyGameData(), playerId );
	}

	/**
	 * Core move execution logic with validation and hooks.
	 * Validates the move, runs before/after hooks, executes the move, advances the turn,
	 * handles phase transitions, and checks for game completion.
	 * @param playerId - The ID of the player making the move.
	 * @param moveType - The type of move being executed.
	 * @param input - The move-specific input data.
	 */
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

		move.validate( this.readonlyGameData(), playerId, input as NonNullable<M[T]> );
		this.state = move.execute( this.readonlyGameData(), playerId, input as NonNullable<M[T]> );

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

	/**
	 * Gets the bot's move for the current player using the phase or structure bot move function.
	 * @returns The bot's move type and input, or null if no valid bot move is available.
	 */
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

		return botMoveFn( this.readonlyBotGameInfo( playerId ) ) as {
			moveType: keyof M;
			input: M[keyof M]
		};
	}

	/**
	 * Returns the current game phase if using a phased game structure.
	 * @returns The current GamePhase, or null if phases are not configured or no phase is active.
	 */
	private getCurrentPhase(): GamePhase<G, any, C, SV, PV> | null {
		if ( !this.structure.phases || !this.context.phase ) {
			return null;
		}
		return this.structure.phases[ this.context.phase ] ?? null;
	}

	/**
	 * Enters a new game phase, running its onEnter hook and resolving the starting player.
	 * @param phaseName - The name of the phase to enter.
	 */
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

	/**
	 * Transitions from the current phase to a new phase, running onExit on the current phase first.
	 * @param phaseName - The name of the phase to transition to.
	 */
	private transitionToPhase( phaseName: string ) {
		const currentPhase = this.getCurrentPhase();
		if ( currentPhase?.onExit ) {
			this.state = currentPhase.onExit( this.readonlyGameData() );
		}

		this.enterPhase( phaseName );
	}

	/**
	 * Checks if the game has reached the maximum player count.
	 * @returns True if the game is full, false otherwise.
	 */
	private isFull(): boolean {
		return Object.keys( this.players ).length >= this.config.playerCount;
	}

	/**
	 * Returns a frozen copy of the game data for safe reading without mutation.
	 * @returns A read-only snapshot of the game state, config, and context.
	 */
	private readonlyGameData(): ReadonlyGameData<G, C> {
		return {
			state: this.state,
			config: Object.freeze( { ...this.config } ),
			context: Object.freeze( { ...this.context } )
		};
	}

	/**
	 * Returns a frozen merged view (shared + player) of the game data for bot consumption.
	 * @param playerId - The ID of the bot player.
	 * @returns A read-only snapshot combining shared and player-specific views.
	 */
	private readonlyBotGameInfo( playerId: PlayerId ): ReadonlyGameData<SV & PV, C> {
		const sharedState = this.structure.sharedView( this.readonlyGameData() );
		const playerState = this.structure.playerView( this.readonlyGameData(), playerId );
		return {
			state: { ...sharedState, ...playerState },
			config: Object.freeze( { ...this.config } ),
			context: Object.freeze( { ...this.context } )
		};
	}

	/**
	 * Loads game data from Durable Object storage into instance properties.
	 * @returns True if game data was found and loaded, false otherwise.
	 */
	private async loadGameData() {
		const data = await this.ctx.storage.get<BaseGameData & GameData<G, C>>( "gameData" );
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

	/**
	 * Persists the current game data to Durable Object storage.
	 */
	private async saveGameData() {
		await this.ctx.storage.put( "gameData", this.getGameData() );
	}

	/**
	 * Archives completed game data to KV with pre-computed player views,
	 * marks the game as completed in D1.
	 */
	private async archive() {
		const key = `${ this.structure.name }:${ this.id }`;
		const shared = this.getSharedGameInfo();
		const playerViews: Record<string, PlayerGameData<PV>> = {};
		for ( const playerId of Object.keys( this.players ) ) {
			playerViews[ playerId ] = this.getPlayerSpecificInfo( playerId );
		}

		await this.env.GAMES_KV.put( key, JSON.stringify( { shared, playerViews } ) );
		await db.update( games ).set( { completed: 1 } ).where( eq( games.id, this.id ) );
	}

	/**
	 * Syncs the current game state to all connected non-bot players via SyncedStateServer.
	 * Uses a single DO per game (gameName:gameId) with key "shared" for common state
	 * and each playerId as key for player-specific state.
	 */
	private async syncClients() {
		const syncName = `${ this.structure.name }:${ this.id }`;
		const syncId = this.env.SYNCED_STATE_SERVER.idFromName( syncName );
		const syncStub = this.env.SYNCED_STATE_SERVER.get( syncId );

		await syncStub.setState( this.getSharedGameInfo(), "shared" );

		const nonBotPlayers = Object.keys( this.players ).filter( id => !this.players[ id ].isBot );
		for ( const playerId of nonBotPlayers ) {
			await syncStub.setState( this.getPlayerSpecificInfo( playerId ), playerId );
		}
	}

	/**
	 * Schedules a Durable Object alarm if the next player is a bot,
	 * triggering a bot move after a delay.
	 */
	private async scheduleBotIfNeeded() {
		const isNextPlayerBot = !!this.players[ this.context.currentPlayer ]?.isBot;
		if ( this.status === "IN_PROGRESS" && isNextPlayerBot ) {
			await this.ctx.storage.setAlarm( Date.now() + 5000 );
		}
	}
}
