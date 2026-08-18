import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";

import type {
	BaseGameConfig,
	GameView,
	InteractionFrame,
	PlayerId
} from "@/swish/shared/schema.ts";
import { GameCode, GameId } from "@/swish/shared/schema.ts";
import { TestHost } from "@tests/helpers/host.ts";

import type { UserId } from "@/auth/shared/schema.ts";
import type {
	SwishArchive,
	SwishStorage,
	SwishSync,
	SwishTimers
} from "@/swish/server/services.ts";

/** Everything an engine asks of its host, which `TestHost` provides in memory. */
export type HostServices = SwishStorage | SwishArchive | SwishSync | SwishTimers;

/**
 * A `Clock` reading one function. The engine stamps commits and frame deadlines
 * through this while the fake schedule decides what is due from the same
 * reading, so the two cannot drift — which they would if a test moved one and
 * the engine kept reading the wall clock.
 *
 * @param now - The reading both the engine and the schedule share.
 * @returns The clock service to provide.
 */
const clockReading = ( now: () => number ): Clock.Clock => {
	const nanos = () => BigInt( Math.trunc( now() ) ) * 1_000_000n;

	return {
		currentTimeMillisUnsafe: now,
		currentTimeMillis: Effect.sync( now ),
		currentTimeNanosUnsafe: nanos,
		currentTimeNanos: Effect.sync( nanos ),
		monotonicTimeNanosUnsafe: nanos,
		monotonicTimeNanos: Effect.sync( nanos ),
		sleep: () => Effect.void
	};
};

/** What a test may reach into after a run: the store, the archive, the fan-out. */
export type RunCollectors = {
	readonly cells: Map<string, unknown>;
	readonly saved: Map<string, unknown>;
	readonly published: Array<unknown>;
};

/**
 * Drives one engine against in-memory host services and hands back both the
 * body's result and the three collectors, so a test can assert on what was
 * stored, archived and broadcast alongside what it read.
 *
 * The clock is a parameter rather than the wall clock because nothing in the
 * fake schedule fires on its own: a test moves `now` past a timer's due time and
 * then calls `alarm()` deliberately, which is what makes every scheduling test
 * a sequence rather than a wait.
 *
 * @param engine - The engine to build, still needing its host services.
 * @param body - What to run against the built engine.
 * @param [options] - The clock the schedule reads, and collectors to reuse.
 * @returns The body's result and the collectors it ran against.
 */
export const runGame = <Engine, A, E>(
	engine: Effect.Effect<Engine, never, HostServices>,
	body: ( engine: Engine ) => Effect.Effect<A, E>,
	options: {
		readonly now?: () => number;
		readonly cells?: Map<string, unknown>;
		readonly saved?: Map<string, unknown>;
		readonly published?: Array<unknown>;
		readonly pending?: Map<string, number>;
	} = {}
) => {
	const cells = options.cells ?? new Map<string, unknown>();
	const saved = options.saved ?? new Map<string, unknown>();
	const published = options.published ?? [];
	const pending = options.pending ?? new Map<string, number>();
	const now = options.now ?? ( () => Date.now() );

	const program = Effect.gen( function* () {
		return yield* body( yield* engine );
	} ).pipe(
		Effect.provide( TestHost( { cells, saved, published, pending, now } ) ),
		Effect.provideService( Clock.Clock, clockReading( now ) )
	);

	return { result: Effect.runSync( program ), cells, saved, published, pending };
};

/**
 * A clock a test moves by hand: the wall clock plus however much it has been
 * advanced. The engine arms its timers off the real clock, so advancing past a
 * delay is what makes that timer — and only that timer — due on the next
 * `alarm()`, however long the run itself took to get there.
 *
 * @returns The reader the schedule uses, and the control to move it.
 */
export const testClock = () => {
	let offset = 0;

	return {
		now: () => Date.now() + offset,
		advance: ( millis: number ) => { offset += millis; }
	};
};

/** A clock parked a day ahead, so every timer the engine arms is already due. */
export const farFuture = () => Date.now() + 24 * 60 * 60 * 1000;

/**
 * The initialize payload for a game, with the ids every test shares.
 *
 * @param config - The config the table is created with.
 * @param [creator] - Who is creating it. Defaults to `a`.
 * @returns The payload `initialize` takes.
 */
export const createInput = <Config extends BaseGameConfig>(
	config: Config,
	creator = "a"
) => ( {
	id: GameId.make( "game-1" ),
	code: GameCode.make( "CODE" ),
	creator: creator as UserId,
	config
} );

/** One commit as the log stores it, with only the fields tests read. */
export type StoredCommit = {
	readonly id: string;
	readonly command: string;
	readonly actor?: PlayerId;
	readonly moveType?: string;
	readonly events: ReadonlyArray<{ readonly _tag: string }>;
};

/**
 * The commit log as it sits in storage, in order. Read straight off the keys so
 * a test asserts against what was really written rather than what the engine
 * says it wrote.
 *
 * @param cells - The backing store the run wrote to.
 * @returns Every commit key's value, ordered by index.
 */
export const commitsIn = ( cells: Map<string, unknown> ) =>
	[ ...cells.entries() ]
		.filter( ( [ key ] ) => key.startsWith( "log:commit:" ) )
		.sort( ( x, y ) => Number( x[ 0 ].split( ":" )[ 2 ] ) - Number( y[ 0 ].split( ":" )[ 2 ] ) )
		.map( ( [ , commit ] ) => commit as StoredCommit );

/**
 * Every event tag the log holds, in the order they were committed.
 *
 * @param cells - The backing store the run wrote to.
 * @returns The tags, flattened across commits.
 */
export const tagsIn = ( cells: Map<string, unknown> ) =>
	commitsIn( cells ).flatMap( commit => commit.events.map( event => event._tag ) );

/**
 * One published fan-out, as `SwishSync` received it.
 */
export type PublishedViews<View, Config extends BaseGameConfig> = {
	readonly table: GameView<View, Config>;
	readonly players: Record<PlayerId, GameView<View, Config>>;
};

/**
 * The pushes a run produced, typed to the game's view.
 *
 * @param published - The collector the run pushed into.
 * @returns The same array, typed.
 */
export const publishedViews = <View, Config extends BaseGameConfig>(
	published: ReadonlyArray<unknown>
) => published as ReadonlyArray<PublishedViews<View, Config>>;

/** The frame currently on top of the interaction stack, if there is one. */
export const topFrame = ( interactions: ReadonlyArray<InteractionFrame> ) =>
	interactions[ interactions.length - 1 ];
