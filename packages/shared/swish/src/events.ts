// @s2h/swish/events — the event-sourcing core.
//
// Pure / browser-safe. Defines the engine's built-in events (which mutate the
// game *envelope* — turn / current player / phase / players / status), the
// `Commit` that groups one command's events, and the pure `fold` that is the
// SINGLE place state changes. Games contribute their own domain events (`Ev`)
// and an `apply` reducer for `state`; the engine owns everything else.
//
// Determinism rule: `engineApply` and a game's `apply` are plain synchronous
// functions — no `Effect`, no `Random`. All nondeterminism happens in the
// *decider* (`execute`/hooks) and is captured in the emitted event's payload,
// so replaying the log reproduces state exactly.

import * as Match from "effect/Match";
import * as Schema from "effect/Schema";
import {
	GameContext,
	GameStatus,
	InteractionFrame,
	type PersistedGameData,
	PlayerId,
	PlayerInfo,
	SeatStatus
} from "./schema";

// --- Engine events ---------------------------------------------------------
// Tags are namespaced `swish/ev/*` so they never collide with a game's own
// event tags in the combined union.

export const PlayerJoined = Schema.TaggedStruct( "swish/ev/PlayerJoined", { player: PlayerInfo } );
export const CurrentPlayerSet = Schema.TaggedStruct(
	"swish/ev/CurrentPlayerSet",
	{ playerId: PlayerId }
);
export const TurnAdvanced = Schema.TaggedStruct( "swish/ev/TurnAdvanced", {} );
export const PhaseEntered = Schema.TaggedStruct(
	"swish/ev/PhaseEntered",
	{ phase: Schema.String }
);
export const PhaseExited = Schema.TaggedStruct( "swish/ev/PhaseExited", { phase: Schema.String } );
export const StatusChanged = Schema.TaggedStruct(
	"swish/ev/StatusChanged",
	{ status: GameStatus }
);
export const GameCompleted = Schema.TaggedStruct( "swish/ev/GameCompleted", {} );

// Reaction / interaction stack events. They mutate only the envelope
// (`context.interactions`), never `state`.
export const InteractionOpened = Schema.TaggedStruct(
	"swish/ev/InteractionOpened",
	{ frame: InteractionFrame }
);
export const InteractionResponded = Schema.TaggedStruct(
	"swish/ev/InteractionResponded",
	{ playerId: PlayerId, response: Schema.Unknown }
);
export const InteractionResolved = Schema.TaggedStruct( "swish/ev/InteractionResolved", {} );

/** The decoded type of an `InteractionOpened` event (games emit this to open a window). */
export type InteractionOpened = typeof InteractionOpened.Type;

/** A seat's status changed (folded / eliminated / out / reinstated to active). */
export const SeatStatusChanged = Schema.TaggedStruct(
	"swish/ev/SeatStatusChanged",
	{ playerId: PlayerId, status: SeatStatus }
);

/** The decoded type of a `SeatStatusChanged` event. */
export type SeatStatusChanged = typeof SeatStatusChanged.Type;

/** The union of built-in engine events. */
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
export type EngineEvent = typeof EngineEvent.Type;

/** True when an event is a built-in engine event (vs. a game domain event). */
export const isEngineEvent = ( event: { readonly _tag: string } ): event is EngineEvent =>
	event._tag.startsWith( "swish/ev/" );

// Rebuild a `GameContext` (a TaggedClass) with a field patch — constructing
// explicitly avoids spreading the instance's `_tag`.
const patchContext = ( ctx: GameContext, patch: Partial<Omit<GameContext, "_tag">> ) =>
	GameContext.make( {
		turn: patch.turn ?? ctx.turn,
		players: patch.players ?? ctx.players,
		currentPlayer: patch.currentPlayer ?? ctx.currentPlayer,
		phase: patch.phase ?? ctx.phase,
		// `in` check so an explicit `undefined` clears the stack (a `??` fallback
		// could never set it back to empty).
		interactions: "interactions" in patch ? patch.interactions : ctx.interactions,
		seats: "seats" in patch ? patch.seats : ctx.seats
	} );

/**
 * Apply one engine event to the envelope. Pure. The `state` is never touched
 * here — game events do that via the game's `apply`.
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
			return {
				...data,
				players,
				context: patchContext( data.context, { players: ids, currentPlayer } )
			};
		} ),
		Match.tag( "swish/ev/CurrentPlayerSet", ( e ) =>
			( { ...data, context: patchContext( data.context, { currentPlayer: e.playerId } ) } ) ),
		Match.tag( "swish/ev/TurnAdvanced", () =>
			( { ...data, context: patchContext( data.context, { turn: data.context.turn + 1 } ) } ) ),
		Match.tag( "swish/ev/PhaseEntered", ( e ) =>
			( { ...data, context: patchContext( data.context, { phase: e.phase } ) } ) ),
		// PhaseExited is a marker for the log; the entered phase sets `context.phase`.
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
 * Fold a sequence of events onto a persisted record. Engine events mutate the
 * envelope; game events go through the game's `apply` on `state`. This is the
 * only function that produces new state.
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

/** The active (top-of-stack) interaction frame, or undefined if none is open. */
export const activeInteraction = ( ctx: GameContext ): InteractionFrame | undefined => {
	const stack = ctx.interactions;
	return stack && stack.length > 0 ? stack[ stack.length - 1 ] : undefined;
};

/** Build an `InteractionOpened` event from a frame (games call this in `execute`). */
export const openInteraction = ( frame: InteractionFrame ) => InteractionOpened.make( { frame } );

/** In a sequential frame, the first responder who has not yet responded. */
export const nextSequentialResponder = ( frame: InteractionFrame ): PlayerId | undefined =>
	frame.responders.find( ( id ) => !( id in frame.responses ) );

// --- Seat helpers ----------------------------------------------------------

/** A seat's status; absent ⇒ "active". */
export const seatStatus = ( ctx: GameContext, id: PlayerId ) => ctx.seats?.[ id ] ?? "active";

/** Whether a seat is still in play. */
export const isActiveSeat = ( ctx: GameContext, id: PlayerId ) => seatStatus( ctx, id ) === "active";

/** The roster, in order, filtered to seats still in play. */
export const activeSeats = ( ctx: GameContext ): ReadonlyArray<PlayerId> =>
	ctx.players.filter( ( id ) => isActiveSeat( ctx, id ) );

// --- Commit ----------------------------------------------------------------

/** The combined event schema for a game: engine events ⊕ the game's events. */
export const makeEventSchema = <Ev extends Schema.Top>( gameEvent: Ev ) =>
	Schema.Union( [ EngineEvent, gameEvent ] );

/**
 * The schema of a commit — one command's batch of events plus metadata. Stored
 * (encoded) in the append-only `EventStore`.
 */
export const EventsCommit = <Ev extends Schema.Top>( gameEvent: Ev ) =>
	Schema.Struct( {
		id: Schema.String,
		command: Schema.String,
		actor: Schema.optional( PlayerId ),
		moveType: Schema.optional( Schema.String ),
		// #13: client-supplied idempotency key, used to dedupe retried moves.
		requestId: Schema.optional( Schema.String ),
		at: Schema.Number,
		events: Schema.Array( makeEventSchema( gameEvent ) )
	} );
