import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import * as Persistable from "effect/persistence/Persistable";
import * as Persistence from "effect/persistence/Persistence";

import type { BaseGameConfig, BaseGameEvent, GameId } from "@/swish/schema";
import { GameDocument } from "@/swish/schema";

/**
 * How long a game is kept hot. Long enough to outlive any single sitting plus a
 * wide margin for the archive to run: the log lives here for the whole game and
 * only reaches Postgres when the game completes, so an entry expiring early
 * would take the history with it.
 */
const DEFAULT_TIME_TO_LIVE = Duration.hours( 24 );

// --- The Store -------------------------------------------------------------

/**
 * Builds the hot store for one game type: the live document, kept in Redis under
 * `swish:<game>:<gameId>`.
 *
 * This is a cache with weight. The log is buffered here for the whole game and
 * is only written to Postgres when the game completes, so until then Redis holds
 * the only copy of the history — which is why the TTL is generous and why every
 * commit writes through rather than being flushed on passivation.
 *
 * The whole document is rewritten on each commit, since `Persistence` offers no
 * append, and `save` is a plain overwrite: `PersistenceStore` has no
 * compare-and-set, so nothing here can tell a write that follows a read from one
 * that lands on top of somebody else's.
 *
 * Two things make that safe, at different distances. The entity serializes the
 * writers themselves — one game is one entity instance, running one command at a
 * time — so the second command reads the first one's result instead of
 * overwriting it. `document.version` catches what that cannot: the turn clock is
 * armed by a write and fires later, on its own, so a timer armed against a
 * version the game has since moved past is declined by `tick` rather than
 * replaying a turn that already happened.
 *
 * Not a `Context.Service`, because the document schema is generic in the game's
 * own state, config and events — there is no one type a shared tag could carry.
 * Each game builds its own inside the entity, the way the ledger builds its own
 * queries over a feature's tables.
 *
 * @param name - The game's name; namespaces the Redis keys.
 * @param schemas - The game's state, config and event schemas.
 * @param options - Overrides for how long a live game is kept.
 * @returns The store's `load`/`save`/`remove` operations.
 */
export const makeGameStore = <State, Config extends BaseGameConfig, Events extends BaseGameEvent>(
	name: string,
	schemas: {
		readonly state: Schema.Codec<State, unknown>;
		readonly config: Schema.Codec<Config, unknown>;
		readonly events: Schema.Codec<Events, unknown>;
	},
	options?: {
		readonly timeToLive?: Duration.Duration;
	}
) => Effect.gen( function* () {
	const persistence = yield* Persistence.Persistence;
	const timeToLive = options?.timeToLive ?? DEFAULT_TIME_TO_LIVE;
	const Document = GameDocument( schemas.state, schemas.config, schemas.events );

	class DocumentEntry extends Persistable.Class<{ payload: { gameId: string } }>()(
		"swish/GameDocument",
		{ primaryKey: ( { gameId } ) => gameId, success: Document }
	) {}

	const store = yield* persistence.make( {
		storeId: `swish:${ name }`,
		timeToLive: ( exit ) => Exit.isSuccess( exit ) ? timeToLive : Duration.zero
	} );

	/**
	 * Reads a game's document. `None` covers both a game that never existed and
	 * one whose entry has expired — the caller cannot act on either, and the
	 * archive is where a finished game is looked for instead.
	 */
	const load = Effect.fn( function* ( gameId: GameId ) {
		const entry = new DocumentEntry( { gameId } );
		const result = yield* store.get( entry ).pipe( Effect.orDie );
		return result && Exit.isSuccess( result ) ? Option.some( result.value ) : Option.none();
	} );

	/** Writes a game's document, refreshing its TTL. */
	const save = Effect.fn( function* (
		gameId: GameId,
		document: GameDocument<State, Config, Events>
	) {
		const entry = new DocumentEntry( { gameId } );
		yield* store.set( entry, Exit.succeed( document ) ).pipe( Effect.orDie );
	} );

	/** Drops a game's document. Called once its log has reached the archive. */
	const remove = Effect.fn( function* ( gameId: GameId ) {
		const entry = new DocumentEntry( { gameId } );
		yield* store.remove( entry ).pipe( Effect.orDie );
	} );

	return { load, save, remove } as const;
} );
