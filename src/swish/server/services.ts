import * as Context from "effect/Context";

import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import type { games } from "@/platform/database/schema.ts";
import type {
	AlarmKind,
	ArchivedGame,
	AudienceViews,
	BaseGameConfig,
	Checkpoint,
	CommitWrite,
	GameAddress,
	GameCode,
	GameId,
	GameNotFound,
	GameRef,
	LedgerEntry,
	PlayerId,
	PlayerInfo,
	TableProjection,
	TurnTimers
} from "@/swish/shared/schema.ts";

/**
 * The engine's store: the commit log, the record the log folds into, and the
 * autoplay map that sits beside them. Every read and write a command performs
 * is a method here, so how a commit is keyed, when a checkpoint is taken and what
 * a single transaction has to cover are the implementation's business rather than
 * the engine's.
 *
 * Values round-trip raw — nothing crossing this boundary is schema-encoded — so
 * the store is trusted to preserve whatever it was handed.
 *
 * Three invariants an implementation owes the engine:
 * - **The commits are contiguous**, from `0` to `commitCount - 1`. Committing
 *   after an undo forks the history by *shrinking* that count, so commits at or
 *   past it belong to a history that no longer exists and are never read.
 * - **`version === cursor + 1`**, the number of commits folded into the record.
 *   `writeCommit` hands its `stamp` the version it assigned, so the record it
 *   materializes carries the version of the log it was built from.
 * - **One command, one transaction.** Everything a `write*` touches lands
 *   atomically, or a mid-command failure desynchronizes the log from the record.
 */
export class SwishStorage extends Context.Service<SwishStorage, {

	/** Reads the materialized record, absent until the game is initialized. */
	readonly readRecord: <Data>() => Effect.Effect<Data | undefined>;

	/** Reads the genesis record every rebuild without a checkpoint folds from. */
	readonly readBase: <Data>() => Effect.Effect<Data | undefined>;

	/**
	 * Reads one commit by position. Callers stay below `readCommitCount`.
	 * @param index - The commit's position in the log.
	 * @returns The commit, if the log holds one there.
	 */
	readonly readCommit: <Commit>( index: number ) => Effect.Effect<Commit | undefined>;

	/** Reads how many commits the log holds; `0` before anything is committed. */
	readonly readCommitCount: () => Effect.Effect<number>;

	/** Reads the cursor — the newest applied commit, or `-1` when there is none. */
	readonly readCursor: () => Effect.Effect<number>;

	/** Reads the cursor of the commit that started the game, or `-1`. */
	readonly readStartCommitCursor: () => Effect.Effect<number>;

	/** Reads the cursor of the commit that completed the game, or `-1`. */
	readonly readCompletedCommitCursor: () => Effect.Effect<number>;

	/**
	 * Finds the newest checkpoint a rebuild at a cursor may fold from, so a
	 * replay covers a bounded tail of the log rather than the whole game.
	 *
	 * @param cursor - The position being rebuilt at.
	 * @returns The usable checkpoint, if one survives at or before the cursor.
	 */
	readonly nearestCheckpoint: <Data>( cursor: number ) => Effect.Effect<Checkpoint<Data> | undefined>;

	/**
	 * Creates the log: the genesis record as both base and materialized record,
	 * with an empty commit log beneath it.
	 *
	 * @param genesis - The record the game starts from.
	 */
	readonly writeGenesis: <Data>( genesis: Data ) => Effect.Effect<void>;

	/**
	 * Replaces the materialized record without touching the log. Used to heal a
	 * record that has drifted from the cursor.
	 *
	 * @param record - The record to materialize.
	 */
	readonly writeRecord: <Data>( record: Data ) => Effect.Effect<void>;

	/**
	 * Appends a commit at `cursor + 1` and materializes the record it produced.
	 * Committing after an undo therefore forks the history: the count shrinks to
	 * the new commit, stranding whatever sat above it.
	 *
	 * @param write - The commit, the record to stamp, and the markers it sets.
	 * @returns The record as materialized, carrying the version the log assigned.
	 */
	readonly writeCommit: <Data, Commit extends { readonly id: string }>(
		write: CommitWrite<Data, Commit>
	) => Effect.Effect<Data>;

	/**
	 * Travels the log: points the cursor at another commit and materializes the
	 * record rebuilt there. The log itself is left alone, which is what keeps a
	 * redo within reach until a new commit forks it away.
	 *
	 * @param cursor - The commit to move to.
	 * @param record - The record rebuilt at that cursor.
	 */
	readonly moveCursor: <Data>( cursor: number, record: Data ) => Effect.Effect<void>;

	/** Reads the seats the bot policy is playing; empty when nobody handed one over. */
	readonly readAutoPlay: () => Effect.Effect<Record<PlayerId, boolean>>;

	/**
	 * Hands one seat to the bot policy, or takes it back. Outside the log on
	 * purpose: autoplay schedules the game rather than describing it, so it
	 * neither moves the version nor rewinds under undo.
	 *
	 * @param playerId - The seat being switched.
	 * @param enabled - `true` to let the policy play it.
	 */
	readonly writeAutoPlay: ( playerId: PlayerId, enabled: boolean ) => Effect.Effect<void>;

	/** Reads the game this table agreed to play next, if it agreed on one. */
	readonly readRematch: () => Effect.Effect<GameRef | undefined>;

	/**
	 * Records the game this table plays next. Outside the log for the same reason
	 * autoplay is: it is a fact about what happens after this game, not part of
	 * the game that was played, so it neither moves the version nor rewinds.
	 *
	 * Written once and never overwritten — which game a table moved on to is
	 * settled elsewhere, before this is called, and this only publishes it.
	 *
	 * @param ref - The game the table moved on to.
	 */
	readonly writeRematch: ( ref: GameRef ) => Effect.Effect<void>;

	/** Erases the game: log, record and scheduling facts alike. */
	readonly clear: () => Effect.Effect<void>;

}>()( "swish/Storage" ) {}

/**
 * Realtime fan-out. After every state-changing command the engine hands the host
 * a fresh `GameView` per audience; the host pushes each connected client the view
 * for its own audience, and any spectator the table's. Every view carries the
 * same envelope a read returns, so a client decodes one shape however it arrived.
 * Game-agnostic: the payloads are plain JSON-serializable values the engine
 * already computed, so the host never touches game schemas. A no-op layer backs
 * tests / pushless deployments.
 */
export class SwishSync extends Context.Service<SwishSync, {

	/**
	 * Pushes one state change to everyone watching a game.
	 * @param views - The table's view and each player's own.
	 */
	readonly publish: <View>( views: AudienceViews<View> ) => Effect.Effect<void>;

}>()( "swish/Sync" ) {}

/**
 * Deferred work: multiple named timers, each firing an `AlarmKind`. The host
 * keeps a `kind -> time` map and arms its single wake-up at the earliest pending
 * one; on wake it returns (and clears) the timers now due and re-arms for the
 * next. This lets a bot delay, a reaction deadline and a move clock all run
 * concurrently.
 *
 * The service also owns the *published* deadline, because a move clock is one
 * fact and not two: the alarm that fires it and the countdown the seat's client
 * renders have to be the same instant, so `rearm` derives both from one reading
 * of the clock. It is stored rather than folded — a scheduling fact, not game
 * state — so undo cannot rewind it and a rebuild cannot resurrect a spent one.
 */
export class SwishTimers extends Context.Service<SwishTimers, {

	/**
	 * Replaces the turn's clocks wholesale: whatever `bot`, `move-timeout` and
	 * `interaction-timeout` were pending is dropped, and exactly what the argument
	 * asks for is armed. The published deadline follows the move clock, and a
	 * frame deadline already in the past is not armed — it belongs to a frame on
	 * its way to being settled, and waking at zero would loop the host.
	 *
	 * `auto-start` is left alone: it belongs to a game that has not started, and
	 * this governs one that has.
	 *
	 * @param turn - The clocks this turn runs under. Empty cancels them all.
	 */
	readonly rearm: ( turn: TurnTimers ) => Effect.Effect<void>;

	/**
	 * Arms the delay before a full table starts itself. Outside `rearm` because it
	 * is the one timer that belongs to a game not yet in play.
	 *
	 * @param delayMillis - How long to wait before starting.
	 */
	readonly armAutoStart: ( delayMillis: number ) => Effect.Effect<void>;

	/** Reads when the pending seat's move clock runs out, if one is running. */
	readonly deadline: () => Effect.Effect<number | undefined>;

	/** Drops every pending timer, `auto-start` included. */
	readonly cancelAll: () => Effect.Effect<void>;

	/** Returns the timers now due, clearing them. */
	readonly due: () => Effect.Effect<ReadonlyArray<AlarmKind>>;

}>()( "swish/Timers" ) {}

/**
 * The one thing that happens when a game ends.
 *
 * A completed game has to be filed in cold storage and its result recorded, and
 * neither belongs on the command a table is waiting on: both are somebody
 * else's store, either can be slow or down, and the game is already over by the
 * time they matter. So the engine hands the finished game here and returns —
 * one hop — and whatever is on the other end does the filing at its own pace.
 *
 * The engine hands over the whole {@link ArchivedGame} and nothing else, which
 * is what lets the far end stay game-agnostic: everything a store needs is
 * derivable from it, and the outbox is free to decide what to do with the rest.
 *
 * Delivery is expected to be at-least-once and may be late, so an
 * implementation must settle anything time- or rule-dependent *here*, where the
 * game just ended — a consumer that read its own clock, or re-derived its own
 * verdict, would answer differently on a redelivery than it did the first time.
 */
export class SwishOutbox extends Context.Service<SwishOutbox, {

	/**
	 * Hands over a finished game.
	 *
	 * The projection travels beside the archive rather than being derived from it
	 * downstream, so that closing a game out writes the table's status through the
	 * same guarded path every other status write takes.
	 *
	 * @param address - The game that completed.
	 * @param data - The archived game, with its standings on it.
	 * @param projection - The table as it stood when it finished.
	 */
	readonly publishArchive: <V, C extends BaseGameConfig>(
		address: GameAddress,
		data: ArchivedGame<V, C>,
		projection: TableProjection
	) => Effect.Effect<void>;

	/**
	 * Announces a table whose projection moved — a seat taken, or play beginning.
	 *
	 * Separate from {@link publishArchive} because the two carry different things
	 * and fail differently: losing an archive costs a finished game its record,
	 * while losing one of these costs a lobby row its freshness until the table's
	 * next move. Neither is worth holding a command open for.
	 *
	 * Never called with a `COMPLETED` projection — that one rides the archive, so
	 * the status cannot be flipped before the archive it points at has landed.
	 *
	 * @param address - The table.
	 * @param projection - The table as it now stands.
	 */
	readonly publishStatus: (
		address: GameAddress,
		projection: TableProjection
	) => Effect.Effect<void>;

}>()( "swish/Outbox" ) {}

/**
 * Every question and every write swish puts to the relational store: the games
 * table, the people seated at them, their chat channels, and the results a
 * finished game leaves behind.
 *
 * It exists as one service rather than as raw queries spread through the API
 * handlers so that the two callers — the HTTP handlers, which create and find
 * games, and whatever consumes a {@link SwishOutbox} completion, which records
 * results — reach the database the same way, and so that neither has to know
 * which tables a game touches.
 *
 * A game is always looked up *by its kind as well as its id*: a game of another
 * kind is not this one, and answering with it would let a callbreak id address a
 * fish table. Every read answers `undefined` rather than failing, because what a
 * miss means belongs to the caller — `GameNotFound` to a handler, a no-op to a
 * consumer.
 *
 * Rows come back as {@link GameRef} rather than as table rows: `id` and `code`
 * are all any caller reads, and returning them keeps the ORM out of this
 * boundary entirely.
 */
export class SwishDatabase extends Context.Service<SwishDatabase, {

	/**
	 * Finds one game of a kind by id, and says whether it is over — which is the
	 * one fact about a game that decides where its state should be read from.
	 *
	 * @param game - Which game this is a table of.
	 * @param id - The table.
	 */
	readonly findGame: ( address: GameAddress ) => Effect.Effect<typeof games.$inferSelect, GameNotFound>;

	/**
	 * Finds one game of a kind by the code people type to join it.
	 * @param game - Which game this is a table of.
	 * @param code - The join code.
	 */
	readonly findGameByCode: ( game: string, code: GameCode ) => Effect.Effect<GameRef, GameNotFound>;

	/**
	 * Finds the game a finished one was rematched into, if somebody called it.
	 * @param game - Which game this is a table of.
	 * @param sourceId - The finished game.
	 */
	readonly findRematch: ( game: string, sourceId: GameId ) => Effect.Effect<GameRef | undefined>;

	/**
	 * Opens a new table, generating its id and its code.
	 *
	 * Visibility is set on the insert rather than reported later, because it is
	 * the one fact about a table that must be true before anybody can read the
	 * row: everything else arrives over a queue, and a table waiting to be
	 * described is safely invisible — but a table meant to stay invisible cannot
	 * be public for even that long.
	 *
	 * @param game - Which game this is a table of.
	 * @param isPrivate - Whether to keep it out of the open-table listing.
	 */
	readonly createGame: ( game: string, isPrivate: boolean ) => Effect.Effect<GameRef>;

	/**
	 * Opens the one table that follows a finished one, and *only* one: `rematch_of`
	 * is unique, so the insert that has to happen anyway is what settles a race
	 * between everybody at the table pressing the button at once. A caller who
	 * loses gets `undefined` and is expected to read the winner's row back.
	 *
	 * @param game - Which game this is a table of.
	 * @param sourceId - The finished game being rematched.
	 * @param isPrivate - The visibility the finished game had, which the next one keeps.
	 * @returns The new table, or `undefined` if somebody else already claimed it.
	 */
	readonly claimRematch: (
		game: string,
		sourceId: GameId,
		isPrivate: boolean
	) => Effect.Effect<GameRef | undefined>;

	/**
	 * Seats people at a table. Idempotent — a re-join is a silent no-op for the
	 * engine and has to be one here too, or the second attempt collides with the
	 * key the player and the game share.
	 *
	 * @param gameId - The table.
	 * @param players - The people to seat. Empty is a no-op.
	 */
	readonly seatPlayers: (
		gameId: GameId,
		players: ReadonlyArray<Omit<PlayerInfo, "isBot">>
	) => Effect.Effect<void>;

	/**
	 * Posts a finished game's result: one line per ranked seat. Idempotent, so
	 * posting the same completion twice leaves the same rows rather than a second
	 * set.
	 *
	 * Marking the game over is deliberately *not* part of this. That is a status
	 * write like any other and belongs to {@link syncStatus}, which owns the
	 * column and the guard protecting it; splitting them is what lets a consumer
	 * order the three writes a completion needs — archive, then rows, then the
	 * flag that sends readers to the archive.
	 *
	 * @param address - The game that completed.
	 * @param entries - One line per ranked seat. Empty when the game ranks nobody.
	 * @param completedAt - When it finished, as read from the engine's clock.
	 */
	readonly recordResults: (
		address: GameAddress,
		entries: ReadonlyArray<LedgerEntry>,
		completedAt: number
	) => Effect.Effect<void>;

	/**
	 * Writes a table's projection — the sole writer of the status column.
	 *
	 * The queue delivers at least once and in no particular order, so this keeps
	 * only what is newer than the row already holds: a redelivery and a message
	 * overtaken by a later one are the same case, and both are a no-op rather than
	 * an error. The engine's version is what makes that comparable — see
	 * {@link TableProjection}.
	 *
	 * @param address - The table.
	 * @param projection - The table as of that version.
	 */
	readonly syncStatus: (
		address: GameAddress,
		projection: TableProjection
	) => Effect.Effect<void>;

	/**
	 * The finished games whose Durable Object still holds the game it played —
	 * over, filed, and not yet swept. Addresses rather than ids, because a sweeper
	 * has to know *which* object namespace a game lives in before it can reach it.
	 *
	 * Bounded because the caller is a scheduled pass with a wall-clock budget and
	 * the backlog is unbounded: a sweep clears what it can and the next one picks
	 * up where it left off, which is only true because the rows it cleared no
	 * longer answer this query.
	 *
	 * @param limit - The most games to return.
	 * @returns The games to sweep, oldest first.
	 */
	readonly findCleanableGames: ( limit: number ) => Effect.Effect<ReadonlyArray<GameAddress>>;

	/**
	 * Marks games as swept, so the next pass leaves them alone.
	 *
	 * Keyed on the id alone rather than on the address, unlike every read here:
	 * the ids come from {@link findCleanableGames}, so they already name rows of
	 * the kind they were read as, and there is no second game a primary key could
	 * answer with.
	 *
	 * Called *after* the objects were emptied, never before — see the sweeper for
	 * why that order is the repairable one.
	 *
	 * @param ids - The games swept. Empty is a no-op.
	 */
	readonly markCleanedUp: ( ids: ReadonlyArray<GameId> ) => Effect.Effect<void>;

}>()( "swish/Database" ) {}

/**
 * The cold store for finished games, addressed by game and id — what that
 * becomes as a key is the store's business. Written once, by whatever consumes
 * a {@link SwishOutbox} completion, and read by the HTTP handlers when somebody
 * asks after a game that is over. Game-agnostic: values crossing this boundary
 * are already schema-*encoded* (plain JSON).
 */
export class SwishArchive extends Context.Service<SwishArchive, {

	/**
	 * Files a finished game.
	 * @param address - The game being archived.
	 * @param encoded - The archived game, already schema-encoded.
	 */
	readonly save: ( address: GameAddress, encoded: unknown ) => Effect.Effect<void>;

	/**
	 * Reads a game back out of cold storage.
	 * @param address - The game being read.
	 * @returns The encoded archive, if one was ever filed.
	 */
	readonly load: <T>( address: GameAddress ) => Effect.Effect<Option.Option<T>>;

}>()( "swish/Archive" ) {}
