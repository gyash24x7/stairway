import * as Schema from "effect/Schema";

import type { MovesOf, ViewOf } from "@tests/harness/table";

import type { Rng } from "@/shared/utils/rng";
import { makeRng } from "@/shared/utils/rng";
import type { InvalidMove } from "@/swish/errors";
import type {
	Audience,
	BaseGameConfig,
	BaseGameEvent,
	GameContext,
	GameData,
	GameRecord,
	InteractionFrame,
	PlayerId,
	Standings
} from "@/swish/schema";
import { GameContext as Context, GameId, InteractionOpened, TableAudience } from "@/swish/schema";
import { foldEvents } from "@/swish/server/events";


/**
 * What any rule may emit: the game's own events, plus the one engine event a
 * game is allowed to raise for itself.
 */
export type Emitted<Events> = Events | InteractionOpened;

/**
 * The windows an emitted batch opened, in order.
 *
 * Saves every assertion about a window from casting its way through the event
 * union, and reads the way the rule does — "this move opens a window" rather
 * than "the third event happens to be one".
 *
 * @param events - What a rule emitted.
 * @returns Just the windows.
 */
export const windowsIn = ( events: ReadonlyArray<unknown> ) =>
	events.filter( ( event ): event is InteractionOpened => Schema.is( InteractionOpened )( event ) );


type StateOf<S> = S extends { readonly schemas: { readonly state: infer T } }
	? T extends Schema.Codec<infer A, unknown> ? A : never
	: never;

type ConfigOf<S> = S extends { readonly schemas: { readonly config: infer C } }
	? C extends Schema.Codec<infer A, unknown> ? A : never
	: never;

type EventOf<S> = S extends { readonly schemas: { readonly events: infer E } }
	? E extends Schema.Codec<infer A, unknown> ? A : never
	: never;

/** The parts of a `GameContext` a test usually cares to set. */
export type PartialContext = Partial<GameContext>;

export type PositionInput<State, Config> = {
	readonly state: State;
	readonly config: Config;
	readonly context?: PartialContext;

	/** Seeds the rng the structure is handed. Defaults to the position's own id. */
	readonly seed?: string;
};

const baseContext = ( overrides: PartialContext = {} ): GameContext => Context.make( {
	turn: 0,
	players: [],
	teams: {},
	teamNames: {},
	interactions: [],
	interactionCount: 0,
	...overrides
} );


/**
 * A game at one exact position, driven through its own structure.
 *
 * The companion to `makeTable`, and the answer to the thing a table cannot do:
 * seed a hand. A deal is a function of the game id, so through the public API a
 * test gets whatever position the shuffle produced — fine for "does the turn
 * advance", useless for "a player holding the ace of spades must head this
 * trick". Here the position is written down.
 *
 * What it is *not* is a reimplementation of the engine. Events are folded with
 * the engine's own `foldEvents` (`src/swish/server/events.ts:175`), so an event a
 * move emits is routed exactly as a commit would route it — engine events to the
 * header and the context, the game's own to `state` through `structure.apply`.
 * What is deliberately absent is everything the engine wraps *around* a move:
 * the turn guards, the phase gate, the interaction stack, the commit. Those are
 * the table's to test, and testing them here would only test this file.
 *
 * @param structure - The game's structure, as exported by its engine module.
 * @param input - The position to start from.
 * @returns The position, and the ways to ask it questions.
 */
export const atPosition = <Structure extends { readonly name: string }>(
	structure: Structure,
	input: PositionInput<StateOf<Structure>, ConfigOf<Structure>>
) => {
	type State = StateOf<Structure>;
	type Config = ConfigOf<Structure> & BaseGameConfig;
	type Events = EventOf<Structure> & BaseGameEvent;
	type Moves = MovesOf<Structure>;
	type View = ViewOf<Structure>;

	// The structure's own callbacks are typed against the game's concrete types;
	// reading them back off a generic parameter loses that, so this is the one
	// place the harness re-states the shape it already knows to be true.
	const rules = structure as unknown as {
		readonly apply: ( state: State, event: Events ) => State;
		readonly view: ( data: GameData<State, Config>, audience: Audience ) => View;
		readonly endIf: ( data: GameData<State, Config> ) => boolean;
		readonly resolveResults?: ( data: GameData<State, Config> ) => Standings;
		readonly resolveNextPlayer?: (
			data: GameData<State, Config>, playerId: PlayerId, moveType: keyof Moves
		) => PlayerId;
		readonly botMove?: ( data: GameData<View, Config> ) => {
			readonly moveType: keyof Moves; readonly input: unknown;
		} | undefined;
		readonly botRespond?: (
			data: GameData<View, Config>, frame: InteractionFrame
		) => { readonly moveType: keyof Moves; readonly input: unknown } | undefined;
		readonly hooks: {
			readonly onJoin?: (
				data: GameData<State, Config>,
				playerId: PlayerId
			) => ReadonlyArray<Emitted<Events>>;
			readonly onStart?: (
				data: GameData<State, Config>, rng: ( salt?: string ) => Rng
			) => ReadonlyArray<Emitted<Events>>;
			readonly beforeMove?: (
				data: GameData<State, Config>, playerId: PlayerId, moveType: keyof Moves
			) => ReadonlyArray<Emitted<Events>>;
			readonly afterMove?: (
				data: GameData<State, Config>, playerId: PlayerId, moveType: keyof Moves
			) => ReadonlyArray<Emitted<Events>>;
			readonly onEnd?: ( data: GameData<State, Config> ) => ReadonlyArray<Emitted<Events>>;
		};
		readonly moves: {
			[K in keyof Moves]: {
				readonly canMove?: ( data: GameData<State, Config>, playerId: PlayerId ) => boolean;
				readonly validate: (
					data: GameData<State, Config>, playerId: PlayerId, in_: Moves[ K ]
				) => InvalidMove | undefined;
				readonly execute: (
					data: GameData<State, Config>,
					playerId: PlayerId,
					in_: Moves[ K ],
					rng: ( salt?: string ) => Rng
				) => ReadonlyArray<Emitted<Events>>;
				readonly endsTurn?: boolean | (
					( data: GameData<State, Config>, playerId: PlayerId, in_: Moves[ K ] ) => boolean
					);
				readonly enabledWhen?: ( config: Config ) => boolean;
			};
		};
		readonly interactions?: Record<string, {
			readonly onResolve: (
				data: GameData<State, Config>, frame: InteractionFrame, rng: ( salt?: string ) => Rng
			) => ReadonlyArray<Emitted<Events>>;
		}>;
		readonly phases?: Record<string, {
			readonly moves: ReadonlyArray<keyof Moves>;
			readonly endIf: ( data: GameData<State, Config> ) => boolean;
			readonly resolveStartingPlayer?: ( data: GameData<State, Config> ) => PlayerId;
			readonly onEnter?: (
				data: GameData<State, Config>, rng: ( salt?: string ) => Rng
			) => ReadonlyArray<Emitted<Events>>;
			readonly onExit?: ( data: GameData<State, Config> ) => ReadonlyArray<Emitted<Events>>;
			readonly resolveNextPhase: ( data: GameData<State, Config> ) => string;
			readonly resolveNextPlayer?: (
				data: GameData<State, Config>, playerId: PlayerId, moveType: keyof Moves
			) => PlayerId;
		}>;
	};

	const seed = input.seed ?? `${ structure.name }-position`;
	const rngAt = ( cursor: number ) => ( salt?: string ) => makeRng( seed, cursor, salt ?? "" );

	let cursor = 0;
	let record: GameRecord<State, Config> = {
		_tag: "swish/GameRecord",
		id: GameId.make( seed ),
		version: 0,
		players: {},
		status: "IN_PROGRESS",
		context: baseContext( input.context ),
		config: input.config as Config,
		state: input.state
	};

	const data = (): GameData<State, Config> => ( {
		state: record.state,
		config: record.config,
		context: record.context
	} );

	const fold = ( events: ReadonlyArray<unknown> ) => {
		record = foldEvents( record, events as ReadonlyArray<Emitted<Events>>, rules.apply );
		cursor++;
		return events;
	};

	const phaseAt = ( name?: string ) => {
		const key = name ?? String( record.context.phase );
		const phase = rules.phases?.[ key ];
		if ( !phase ) {
			throw new Error( `swish tests: ${ structure.name } declares no phase "${ key }"` );
		}

		return phase;
	};

	return {

		/** The position as it now stands. */
		get data() {
			return data();
		},

		/** Just the game-owned state. */
		get state() {
			return record.state;
		},

		/** The engine-owned context. */
		get context() {
			return record.context;
		},

		/** How many folds have happened — the rng's salt, as the engine counts it. */
		get cursor() {
			return cursor;
		},

		/** Folds events onto the position, exactly as a commit would. */
		apply: ( ...events: ReadonlyArray<unknown> ) => fold( events ),

		/** Replaces the context wholesale; for setting up a turn or a phase. */
		setContext: ( overrides: PartialContext ) => {
			record = { ...record, context: baseContext( { ...record.context, ...overrides } ) };
		},

		// --- Move rules ----------------------------------------------------

		canMove: <K extends keyof Moves>( move: K, playerId: PlayerId ) => {
			const rule = rules.moves[ move ];
			return rule.canMove
				? rule.canMove( data(), playerId )
				: playerId === record.context.currentPlayer;
		},

		enabledWhen: <K extends keyof Moves>( move: K ) =>
			rules.moves[ move ].enabledWhen?.( record.config ) ?? true,

		/** The move's own verdict: an `InvalidMove` to refuse, `undefined` to allow. */
		validate: <K extends keyof Moves>( move: K, playerId: PlayerId, in_: Moves[ K ] ) =>
			rules.moves[ move ].validate( data(), playerId, in_ ),

		/** The events the move would emit. Does not fold them. */
		execute: <K extends keyof Moves>( move: K, playerId: PlayerId, in_: Moves[ K ] ) =>
			rules.moves[ move ].execute( data(), playerId, in_, rngAt( cursor ) ),

		endsTurn: <K extends keyof Moves>( move: K, playerId: PlayerId, in_: Moves[ K ] ) => {
			const rule = rules.moves[ move ].endsTurn;
			return typeof rule === "function" ? rule( data(), playerId, in_ ) : rule ?? true;
		},

		/**
		 * Validates, then executes, then folds — the move as the engine plays it,
		 * minus the guards. Throws the `InvalidMove` if the rules refuse it, so a
		 * test that meant the move to be legal fails where it went wrong.
		 */
		play: <K extends keyof Moves>( move: K, playerId: PlayerId, in_: Moves[ K ] ) => {
			const invalid = rules.moves[ move ].validate( data(), playerId, in_ );
			if ( invalid ) {
				throw invalid;
			}

			const before = rules.hooks.beforeMove?.( data(), playerId, move ) ?? [];
			fold( before );

			const events = rules.moves[ move ].execute( data(), playerId, in_, rngAt( cursor ) );
			fold( events );

			const after = rules.hooks.afterMove?.( data(), playerId, move ) ?? [];
			fold( after );

			return [ ...before, ...events, ...after ];
		},

		// --- Hooks ---------------------------------------------------------

		onJoin: ( playerId: PlayerId ) => rules.hooks.onJoin?.( data(), playerId ) ?? [],
		onStart: () => rules.hooks.onStart?.( data(), rngAt( cursor ) ) ?? [],
		beforeMove: <K extends keyof Moves>( playerId: PlayerId, move: K ) =>
			rules.hooks.beforeMove?.( data(), playerId, move ) ?? [],
		afterMove: <K extends keyof Moves>( playerId: PlayerId, move: K ) =>
			rules.hooks.afterMove?.( data(), playerId, move ) ?? [],
		onEnd: () => rules.hooks.onEnd?.( data() ) ?? [],

		// --- Projections ---------------------------------------------------

		view: ( audience: Audience = TableAudience.make( {} ) ) => rules.view( data(), audience ),
		endIf: () => rules.endIf( data() ),
		results: () => rules.resolveResults?.( data() ),
		nextPlayer: <K extends keyof Moves>( playerId: PlayerId, move: K ) =>
			rules.resolveNextPlayer?.( data(), playerId, move ),

		bot: ( audience: Audience ) => rules.botMove?.( {
			state: rules.view( data(), audience ),
			config: record.config,
			context: record.context
		} ),

		botRespond: ( audience: Audience, frame: InteractionFrame ) => rules.botRespond?.( {
			state: rules.view( data(), audience ),
			config: record.config,
			context: record.context
		}, frame ),

		// --- Phases --------------------------------------------------------

		phase: ( name?: string ) => {
			const phase = phaseAt( name );
			return {
				moves: phase.moves,
				endIf: () => phase.endIf( data() ),
				startingPlayer: () => phase.resolveStartingPlayer?.( data() ),
				onEnter: () => phase.onEnter?.( data(), rngAt( cursor ) ) ?? [],
				onExit: () => phase.onExit?.( data() ) ?? [],
				nextPhase: () => phase.resolveNextPhase( data() ),
				nextPlayer: <K extends keyof Moves>( playerId: PlayerId, move: K ) =>
					phase.resolveNextPlayer?.( data(), playerId, move )
			};
		},

		// --- Interactions --------------------------------------------------

		onResolve: ( kind: string, frame: InteractionFrame ) => {
			const declaration = rules.interactions?.[ kind ];
			if ( !declaration ) {
				throw new Error( `swish tests: ${ structure.name } declares no window "${ kind }"` );
			}

			return declaration.onResolve( data(), frame, rngAt( cursor ) );
		}
	};
};
