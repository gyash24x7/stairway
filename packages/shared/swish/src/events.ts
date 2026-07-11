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

import { Match, Schema } from "effect";
import {
	GameContext,
	GameStatus,
	type PersistedGameData,
	PlayerId,
	PlayerInfo
} from "./schema";

// --- Engine events ---------------------------------------------------------
// Tags are namespaced `swish/ev/*` so they never collide with a game's own
// event tags in the combined union.

export const PlayerJoined = Schema.TaggedStruct( "swish/ev/PlayerJoined", { player: PlayerInfo } );
export const CurrentPlayerSet = Schema.TaggedStruct( "swish/ev/CurrentPlayerSet", { playerId: PlayerId } );
export const TurnAdvanced = Schema.TaggedStruct( "swish/ev/TurnAdvanced", {} );
export const PhaseEntered = Schema.TaggedStruct( "swish/ev/PhaseEntered", { phase: Schema.String } );
export const PhaseExited = Schema.TaggedStruct( "swish/ev/PhaseExited", { phase: Schema.String } );
export const StatusChanged = Schema.TaggedStruct( "swish/ev/StatusChanged", { status: GameStatus } );
export const GameCompleted = Schema.TaggedStruct( "swish/ev/GameCompleted", {} );

/** The union of built-in engine events. */
export const EngineEvent = Schema.Union( [
	PlayerJoined,
	CurrentPlayerSet,
	TurnAdvanced,
	PhaseEntered,
	PhaseExited,
	StatusChanged,
	GameCompleted
] );
export type EngineEvent = typeof EngineEvent.Type;

/** True when an event is a built-in engine event (vs. a game domain event). */
export const isEngineEvent = ( event: { readonly _tag: string } ): event is EngineEvent =>
	event._tag.startsWith( "swish/ev/" );

// Rebuild a `GameContext` (a TaggedClass) with a field patch — constructing
// explicitly avoids spreading the instance's `_tag`.
const patchContext = ( ctx: GameContext, patch: Partial<Omit<GameContext, "_tag">> ): GameContext =>
	GameContext.make( {
		turn: patch.turn ?? ctx.turn,
		players: patch.players ?? ctx.players,
		currentPlayer: patch.currentPlayer ?? ctx.currentPlayer,
		phase: patch.phase ?? ctx.phase
	} );

/**
 * Apply one engine event to the envelope. Pure. The `state` is never touched
 * here — game events do that via the game's `apply`.
 */
export const engineApply = <State, Config>(
	data: PersistedGameData<State, Config>,
	event: EngineEvent
): PersistedGameData<State, Config> =>
	Match.value( event ).pipe(
		Match.tag( "swish/ev/PlayerJoined", ( e ) => {
			const players = { ...data.players, [ e.player.id ]: e.player };
			const ids = [ ...data.context.players, e.player.id ];
			const currentPlayer = data.context.players.length === 0
				? e.player.id
				: data.context.currentPlayer;
			return { ...data, players, context: patchContext( data.context, { players: ids, currentPlayer } ) };
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
): PersistedGameData<State, Config> =>
	events.reduce(
		( acc, event ) => isEngineEvent( event )
			? engineApply( acc, event )
			: { ...acc, state: apply( acc.state, event ) },
		data
	);

// --- Commit ----------------------------------------------------------------

/** The combined event schema for a game: engine events ⊕ the game's events. */
export const makeEventSchema = <Ev extends Schema.Top>( gameEvent: Ev ) =>
	Schema.Union( [ EngineEvent, gameEvent ] );

/**
 * The schema of a commit — one command's batch of events plus metadata. Stored
 * (encoded) in the append-only `EventStore`.
 */
export const makeCommitSchema = <Ev extends Schema.Top>( gameEvent: Ev ) =>
	Schema.Struct( {
		id: Schema.String,
		command: Schema.String,
		actor: Schema.optional( PlayerId ),
		moveType: Schema.optional( Schema.String ),
		at: Schema.Number,
		events: Schema.Array( makeEventSchema( gameEvent ) )
	} );

/** A decoded commit for a game whose domain-event type is `Ev`. */
export type Commit<Ev> = {
	readonly id: string;
	readonly command: string;
	readonly actor?: PlayerId;
	readonly moveType?: string;
	readonly at: number;
	readonly events: ReadonlyArray<EngineEvent | Ev>;
};
