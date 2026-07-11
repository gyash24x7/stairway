// @s2h/swish/errors — the engine's typed failure channel.
//
// Pure / browser-safe. Every place the old class-based engine did `throw new
// Error(...)` becomes one of these `Schema.TaggedErrorClass` values. Because
// they are schemas, they travel through the RPC error channel and are decoded
// on the client as discriminated `_tag` members — no string matching.

import { Schema } from "effect";
import { GameId, PlayerId } from "./schema";

/** The game is already at capacity; a further `Join` is rejected. */
export class GameFull extends Schema.TaggedErrorClass<GameFull>()(
	"swish/GameFull",
	{ playerCount: Schema.Number }
) {}

/** This player already holds a seat in the game. */
export class AlreadyJoined extends Schema.TaggedErrorClass<AlreadyJoined>()(
	"swish/AlreadyJoined",
	{ playerId: PlayerId }
) {}

/** A move/lifecycle action requires an IN_PROGRESS game but it is not. */

export class GameNotInProgress extends Schema.TaggedErrorClass<GameNotInProgress>()(
	"swish/GameNotInProgress",
	{ status: Schema.String }
) {}

/** The game cannot start yet (not full / already started). */
export class CannotStart extends Schema.TaggedErrorClass<CannotStart>()(
	"swish/CannotStart",
	{ status: Schema.String }
) {}

/** It is not this player's turn, and the move defines no custom `canMove`. */
export class NotYourTurn extends Schema.TaggedErrorClass<NotYourTurn>()(
	"swish/NotYourTurn",
	{ playerId: PlayerId, currentPlayer: PlayerId }
) {}

/** The requested move is not available in the current (flat or phase) rule set. */
export class MoveNotAllowed extends Schema.TaggedErrorClass<MoveNotAllowed>()(
	"swish/MoveNotAllowed",
	{ move: Schema.String }
) {}

/** A move's `validate` rejected the input. Games raise this from `validate`. */
export class InvalidMove extends Schema.TaggedErrorClass<InvalidMove>()(
	"swish/InvalidMove",
	{ move: Schema.String, reason: Schema.String }
) {}

/** No persisted state was found for this Durable Object (never initialised). */
export class GameNotFound extends Schema.TaggedErrorClass<GameNotFound>()(
	"swish/GameNotFound",
	{ id: GameId }
) {}

/** A phased structure referenced a phase name that does not exist. */
export class PhaseNotFound extends Schema.TaggedErrorClass<PhaseNotFound>()(
	"swish/PhaseNotFound",
	{ phase: Schema.String }
) {}

/** Persisted state failed to decode against the current schema. */
export class CorruptState extends Schema.TaggedErrorClass<CorruptState>()(
	"swish/CorruptState",
	{ id: GameId, reason: Schema.String }
) {}

/** `undo` was called but the cursor is already at the genesis snapshot. */
export class NothingToUndo extends Schema.TaggedErrorClass<NothingToUndo>()(
	"swish/NothingToUndo",
	{}
) {}

/** `redo` was called but the cursor is already at the newest commit. */
export class NothingToRedo extends Schema.TaggedErrorClass<NothingToRedo>()(
	"swish/NothingToRedo",
	{}
) {}

/** Union of the errors a `submitMove` can surface to the client. */
export const MoveError = Schema.Union( [
	InvalidMove,
	NotYourTurn,
	MoveNotAllowed,
	GameNotInProgress,
	PhaseNotFound,
	GameNotFound,
	CorruptState
] );
export type MoveError = typeof MoveError.Type;
