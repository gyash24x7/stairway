import * as Schema from "effect/Schema";

import { GameCode, GameId, PlayerId } from "@/shared/swish/schema.ts";

/**
 * The game is already at capacity; a further `Join` is rejected.
 */
export class GameFull extends Schema.TaggedErrorClass<GameFull>()(
	"swish/GameFull",
	{ playerCount: Schema.Number }
) {}

/**
 * This player already holds a seat in the game.
 */
export class AlreadyJoined extends Schema.TaggedErrorClass<AlreadyJoined>()(
	"swish/AlreadyJoined",
	{ playerId: PlayerId }
) {}

/**
 * A move/lifecycle action requires an IN_PROGRESS game but it is not.
 */
export class GameNotInProgress extends Schema.TaggedErrorClass<GameNotInProgress>()(
	"swish/GameNotInProgress",
	{ status: Schema.String }
) {}

/**
 * The game cannot start yet (not full / already started).
 */
export class CannotStart extends Schema.TaggedErrorClass<CannotStart>()(
	"swish/CannotStart",
	{ status: Schema.String }
) {}

/**
 * It is not this player's turn, and the move defines no custom `canMove`.
 */
export class NotYourTurn extends Schema.TaggedErrorClass<NotYourTurn>()(
	"swish/NotYourTurn",
	{ playerId: PlayerId, currentPlayer: PlayerId }
) {}

/**
 * The requested move is not available in the current (flat or phase) rule set.
 */
export class MoveNotAllowed extends Schema.TaggedErrorClass<MoveNotAllowed>()(
	"swish/MoveNotAllowed",
	{ move: Schema.String }
) {}

/**
 * A move's `validate` rejected the input. Games raise this from `validate`.
 */
export class InvalidMove extends Schema.TaggedErrorClass<InvalidMove>()(
	"swish/InvalidMove",
	{ move: Schema.String, reason: Schema.String }
) {}

/**
 * No persisted state was found for this Durable Object (never initialised).
 */
export class GameNotFound extends Schema.TaggedErrorClass<GameNotFound>()(
	"swish/GameNotFound",
	{ id: Schema.optionalKey( GameId ), code: Schema.optionalKey( GameCode ) }
) {}

/**
 * Optimistic-concurrency guard: the client acted on a stale turn; it should refetch.
 */
export class StaleCommand extends Schema.TaggedErrorClass<StaleCommand>()(
	"swish/StaleCommand",
	{ expected: Schema.Number, actual: Schema.Number }
) {}

/**
 * A phased structure referenced a phase name that does not exist.
 */
export class PhaseNotFound extends Schema.TaggedErrorClass<PhaseNotFound>()(
	"swish/PhaseNotFound",
	{ phase: Schema.String }
) {}

/**
 * Persisted state failed to decode against the current schema.
 */
export class CorruptState extends Schema.TaggedErrorClass<CorruptState>()(
	"swish/CorruptState",
	{ id: GameId, reason: Schema.String }
) {}

/**
 * `undo` was called but the cursor is already at the genesis snapshot.
 */
export class NothingToUndo extends Schema.TaggedErrorClass<NothingToUndo>()(
	"swish/NothingToUndo",
	{}
) {}

/**
 * `redo` was called but the cursor is already at the newest commit.
 */
export class NothingToRedo extends Schema.TaggedErrorClass<NothingToRedo>()(
	"swish/NothingToRedo",
	{}
) {}

/**
 * Union of the errors a `getState` can surface to the client.
 */
export type GetStateError = typeof GetStateError.Type;
export const GetStateError = Schema.Union( [ GameNotFound, CorruptState ] );

/**
 * Union of the errors a `join` can surface to the client.
 */
export type JoinError = typeof JoinError.Type;
export const JoinError = Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] );

/**
 * Union of the errors a `start` can surface to the client.
 */
export type StartError = typeof StartError.Type;
export const StartError = Schema.Union( [
	CannotStart,
	AlreadyJoined,
	GameNotFound,
	CorruptState,
	PhaseNotFound
] );

/**
 * Union of the errors a `submitMove` can surface to the client.
 */
export type MoveError = typeof MoveError.Type;
export const MoveError = Schema.Union( [
	InvalidMove,
	NotYourTurn,
	MoveNotAllowed,
	GameNotInProgress,
	PhaseNotFound,
	GameNotFound,
	CorruptState,
	StaleCommand
] );

/**
 * Union of the errors a `undo` can surface to the client.
 */
export type UndoError = typeof UndoError.Type;
export const UndoError = Schema.Union( [ NothingToUndo, GetStateError ] );

/**
 * Union of the errors a `redo` can surface to the client.
 */
export type RedoError = typeof RedoError.Type;
export const RedoError = Schema.Union( [ NothingToRedo, GetStateError ] );