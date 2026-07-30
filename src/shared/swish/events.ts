import {
	GameContext,
	GameStatus,
	InteractionFrame,
	type PersistedGameData,
	PlayerId,
	PlayerInfo,
	SeatStatus
} from "@/shared/swish/schema.ts";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

// --- Engine events ---------------------------------------------------------
// The built-in events (`swish/ev/*`) the engine emits to patch the envelope.
// `engineApply` is their reducer; games never emit them directly (they emit
// their own domain events, plus the re-exported `InteractionOpened`/
// `SeatStatusChanged` returned from hooks/moves).

/** A player took a seat; seeds `currentPlayer` on the first join and appends to the roster. */
export const PlayerJoined = Schema.TaggedStruct(
	"swish/ev/PlayerJoined",
	{ player: PlayerInfo }
);

/** Sets whose turn it is (starting player, next player, phase starter). */
export const CurrentPlayerSet = Schema.TaggedStruct(
	"swish/ev/CurrentPlayerSet",
	{ playerId: PlayerId }
);

/** Increments the turn counter at the end of a turn-ending move. */
export const TurnAdvanced = Schema.TaggedStruct(
	"swish/ev/TurnAdvanced",
	{}
);

/** Records that a phase was entered (sets `context.phase`). */
export const PhaseEntered = Schema.TaggedStruct(
	"swish/ev/PhaseEntered",
	{ phase: Schema.String }
);

/** Marks a phase left; a bookkeeping/feed marker — `PhaseEntered` sets the new phase. */
export const PhaseExited = Schema.TaggedStruct(
	"swish/ev/PhaseExited",
	{ phase: Schema.String }
);

/** Transitions the game's lifecycle status (e.g. to `PLAYERS_READY` or `IN_PROGRESS`). */
export const StatusChanged = Schema.TaggedStruct(
	"swish/ev/StatusChanged",
	{ status: GameStatus }
);

/** Flips status to `COMPLETED`; emitted once `endIf` first holds. */
export const GameCompleted = Schema.TaggedStruct(
	"swish/ev/GameCompleted",
	{}
);

/** Pushes a reaction window onto the interaction stack. Re-exported for games to emit from `execute`/`resolve`. */
export type InteractionOpened = typeof InteractionOpened.Type;
export const InteractionOpened = Schema.TaggedStruct(
	"swish/ev/InteractionOpened",
	{ frame: InteractionFrame }
);

/** Records one responder's answer into the active (top) frame's `responses`. */
export const InteractionResponded = Schema.TaggedStruct(
	"swish/ev/InteractionResponded",
	{ playerId: PlayerId, response: Schema.Unknown }
);

/** Pops the resolved top frame off the interaction stack. */
export const InteractionResolved = Schema.TaggedStruct(
	"swish/ev/InteractionResolved",
	{}
);

/** Changes a seat's status (fold/eliminate/out). Re-exported for games to emit from hooks/moves. */
export type SeatStatusChanged = typeof SeatStatusChanged.Type;
export const SeatStatusChanged = Schema.TaggedStruct(
	"swish/ev/SeatStatusChanged",
	{ playerId: PlayerId, status: SeatStatus }
);

/** The union of every built-in engine event, folded by `engineApply`. */
export type EngineEvent = typeof EngineEvent.Type;
export const EngineEvent = Schema.Union( [
	PlayerJoined,
	CurrentPlayerSet,
	TurnAdvanced,
	PhaseEntered,
	PhaseExited,
	StatusChanged,
	GameCompleted,
	InteractionOpened,
	InteractionResponded,
	InteractionResolved,
	SeatStatusChanged
] );


/**
 * Determines whether an event is a built-in engine event rather than a game
 * domain event, by testing for the `swish/ev/` tag prefix.
 *
 * @param {{ _tag: string }} event - The event to classify.
 * @returns `true` if the event is an engine event (narrows to `EngineEvent`).
 */
export const isEngineEvent = ( event: { readonly _tag: string } ): event is EngineEvent =>
	event._tag.startsWith( "swish/ev/" );

/**
 * Produces a new `GameContext` with the supplied fields overwritten, leaving the
 * rest untouched. `interactions`/`seats` are patched by key presence (so an
 * explicit `undefined` can clear them), while scalar fields fall back to the
 * current value when omitted.
 *
 * @param {GameContext} ctx - The context to derive from.
 * @param {Partial<Omit<GameContext, "_tag">>} patch - The fields to override.
 * @returns A new context with the patch applied.
 */
const patchContext = ( ctx: GameContext, patch: Partial<Omit<GameContext, "_tag">> ) =>
	GameContext.make( {
		turn: patch.turn ?? ctx.turn,
		players: patch.players ?? ctx.players,
		currentPlayer: patch.currentPlayer ?? ctx.currentPlayer,
		phase: patch.phase ?? ctx.phase,
		interactions: "interactions" in patch ? patch.interactions : ctx.interactions,
		seats: "seats" in patch ? patch.seats : ctx.seats
	} );

/**
 * Applies one engine event to the persisted record's envelope (status, players,
 * context). Pure — the game's `state` is never touched here; game events change
 * state via the game's own `apply`.
 *
 * @param {PersistedGameData} data - The record to derive the next record from.
 * @param {EngineEvent} event - The engine event to apply.
 * @returns A new record with the envelope patched.
 */
export const engineApply = <State, Config>(
	data: PersistedGameData<State, Config>,
	event: EngineEvent
) =>
	Match.value( event ).pipe(
		Match.tag( "swish/ev/PlayerJoined", ( e ) => {
			const players = { ...data.players, [ e.player.id ]: e.player };
			const ids = [ ...data.context.players, e.player.id ];
			const currentPlayer = data.context.players.length === 0
				? e.player.id
				: data.context.currentPlayer;

			const newCtx = patchContext( data.context, { players: ids, currentPlayer } );
			return { ...data, players, context: newCtx };
		} ),

		Match.tag( "swish/ev/CurrentPlayerSet", ( e ) =>
			( { ...data, context: patchContext( data.context, { currentPlayer: e.playerId } ) } ) ),

		Match.tag( "swish/ev/TurnAdvanced", () =>
			( { ...data, context: patchContext( data.context, { turn: data.context.turn + 1 } ) } ) ),

		Match.tag( "swish/ev/PhaseEntered", ( e ) =>
			( { ...data, context: patchContext( data.context, { phase: e.phase } ) } ) ),

		Match.tag( "swish/ev/PhaseExited", () => data ),
		Match.tag( "swish/ev/StatusChanged", ( e ) => ( { ...data, status: e.status } ) ),
		Match.tag( "swish/ev/GameCompleted", () => ( { ...data, status: "COMPLETED" as const } ) ),
		Match.tag( "swish/ev/InteractionOpened", ( e ) =>
			( {
				...data,
				context: patchContext( data.context, {
					interactions: [ ...( data.context.interactions ?? [] ), e.frame ]
				} )
			} ) ),

		Match.tag( "swish/ev/InteractionResponded", ( e ) => {
			const stack = data.context.interactions ?? [];
			if ( stack.length === 0 ) {
				return data;
			}

			const top = stack[ stack.length - 1 ]!;
			const updated = InteractionFrame.make( {
				kind: top.kind,
				initiator: top.initiator,
				responders: top.responders,
				mode: top.mode,
				responses: { ...top.responses, [ e.playerId ]: e.response },
				target: top.target,
				payload: top.payload,
				deadline: top.deadline
			} );

			return {
				...data,
				context: patchContext( data.context, {
					interactions: [ ...stack.slice( 0, -1 ), updated ]
				} )
			};
		} ),

		Match.tag( "swish/ev/InteractionResolved", () => {
			const stack = data.context.interactions ?? [];
			const next = stack.slice( 0, -1 );
			return {
				...data,
				context: patchContext( data.context, {
					interactions: next.length > 0 ? next : undefined
				} )
			};
		} ),

		Match.tag( "swish/ev/SeatStatusChanged", ( e ) =>
			( {
				...data,
				context: patchContext( data.context, {
					seats: { ...( data.context.seats ?? {} ), [ e.playerId ]: e.status }
				} )
			} ) ),

		Match.exhaustive
	);

/**
 * Folds a sequence of events onto a persisted record, in order, to produce the
 * next record. Engine events patch the envelope via `engineApply`; game events
 * go through the game's `apply` on `state`. This is the only function that
 * produces new state.
 *
 * @param {(state, event) => State} apply - The game's pure state reducer.
 * @param {PersistedGameData} data - The starting record.
 * @param {ReadonlyArray<EngineEvent | Ev>} events - The events to fold, in order.
 * @returns The record after applying every event.
 */
export const foldEvents = <State, Config, Ev extends { readonly _tag: string }>(
	apply: ( state: State, event: Ev ) => State,
	data: PersistedGameData<State, Config>,
	events: ReadonlyArray<EngineEvent | Ev>
) =>
	events.reduce(
		( acc, event ) => isEngineEvent( event )
			? engineApply( acc, event )
			: { ...acc, state: apply( acc.state, event ) },
		data
	);

// --- Interaction helpers ---------------------------------------------------

/**
 * Returns the active (top-of-stack) interaction frame — the one the engine is
 * currently routing responses to.
 *
 * @param {GameContext} ctx - The game context holding the interaction stack.
 * @returns The top frame, or `undefined` if no window is open.
 */
export const activeInteraction = ( ctx: GameContext ) => {
	const stack = ctx.interactions;
	return stack && stack.length > 0 ? stack[ stack.length - 1 ] : undefined;
};

/**
 * Builds an `InteractionOpened` event from a frame. Games call this in a move's
 * `execute` (or an interaction's `resolve`) to open/nest a reaction window.
 *
 * @param {InteractionFrame} frame - The reaction window to open.
 * @returns The event that pushes the frame onto the stack.
 */
export const openInteraction = ( frame: InteractionFrame ) => InteractionOpened.make( { frame } );

/**
 * Finds the next responder to act in a sequential frame: the first responder, in
 * order, who has not yet answered.
 *
 * @param {InteractionFrame} frame - The sequential frame to inspect.
 * @returns The pending responder, or `undefined` if all have answered.
 */
export const nextSequentialResponder = ( frame: InteractionFrame ): PlayerId | undefined =>
	frame.responders.find( ( id ) => !( id in frame.responses ) );

// --- Seat helpers ----------------------------------------------------------

/**
 * Reads a seat's status, treating an absent entry as `"active"`.
 *
 * @param {GameContext} ctx - The game context holding seat statuses.
 * @param {PlayerId} id - The seat to read.
 * @returns The seat's status (`"active"` when unset).
 */
export const seatStatus = ( ctx: GameContext, id: PlayerId ) => ctx.seats?.[ id ] ?? "active";

/**
 * Determines whether a seat is still in play (has not folded/been eliminated).
 *
 * @param {GameContext} ctx - The game context holding seat statuses.
 * @param {PlayerId} id - The seat to test.
 * @returns `true` if the seat's status is `"active"`.
 */
export const isActiveSeat = ( ctx: GameContext, id: PlayerId ) =>
	seatStatus( ctx, id ) === "active";

/**
 * Returns the roster in seating order, filtered to seats still in play — the
 * order games walk to skip folded/eliminated players when advancing turns.
 *
 * @param {GameContext} ctx - The game context holding the roster and seat statuses.
 * @returns The active seats, in order.
 */
export const activeSeats = ( ctx: GameContext ): ReadonlyArray<PlayerId> =>
	ctx.players.filter( ( id ) => isActiveSeat( ctx, id ) );

// --- Commit ----------------------------------------------------------------

/**
 * Builds the combined event schema for a game: the union of engine events and
 * the game's own events, used to encode/decode everything in the log.
 *
 * @param {Schema.Top} gameEvent - The game's event schema (typically a union).
 * @returns The `EngineEvent ⊕ gameEvent` union schema.
 */
export const makeEventSchema = <Ev extends Schema.Top>( gameEvent: Ev ) =>
	Schema.Union( [ EngineEvent, gameEvent ] );

/**
 * Builds the schema of a commit — one command's batch of events plus its metadata
 * (id, command name, actor, moveType, requestId, timestamp). Commits are stored
 * encoded in the append-only `EventStore`.
 *
 * @param {Schema.Top} gameEvent - The game's event schema, woven into the commit's event array.
 * @returns The commit schema for this game.
 */
export const EventsCommit = <Ev extends Schema.Top>( gameEvent: Ev ) =>
	Schema.Struct( {
		id: Schema.String,
		command: Schema.String,
		actor: Schema.optional( PlayerId ),
		moveType: Schema.optional( Schema.String ),
		requestId: Schema.optional( Schema.String ),
		at: Schema.Number,
		events: Schema.Array( makeEventSchema( gameEvent ) )
	} );
