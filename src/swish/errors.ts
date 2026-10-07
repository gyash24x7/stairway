import * as Schema from "effect/Schema";

import { GameId, PlayerId } from "@/swish/schema";


// --- Game Errors ---------------------------------------------

/**
 * The game is already at capacity; a further `Join` is rejected.
 */
export class GameFull extends Schema.TaggedError<GameFull>()(
	"swish/GameFull",
	{ playerCount: Schema.Number },
	{ httpApiStatus: 409 }
) {}

/**
 * This player already holds a seat in the game.
 */
export class AlreadyJoined extends Schema.TaggedError<AlreadyJoined>()(
	"swish/AlreadyJoined",
	{ playerId: PlayerId },
	{ httpApiStatus: 409 }
) {}

/**
 * The game has already started (or finished), so no further seats may be taken.
 */
export class GameNotJoinable extends Schema.TaggedError<GameNotJoinable>()(
	"swish/GameNotJoinable",
	{ status: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * A move/lifecycle action requires an IN_PROGRESS game but it is not.
 */
export class GameNotInProgress extends Schema.TaggedError<GameNotInProgress>()(
	"swish/GameNotInProgress",
	{ status: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * The game cannot start yet (not full / already started).
 */
export class CannotStart extends Schema.TaggedError<CannotStart>()(
	"swish/CannotStart",
	{ status: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * It is not this player's turn, and the move defines no custom `canMove`.
 */
export class NotYourTurn extends Schema.TaggedError<NotYourTurn>()(
	"swish/NotYourTurn",
	{ playerId: PlayerId, currentPlayer: PlayerId },
	{ httpApiStatus: 409 }
) {}

/**
 * The requested move is not available in the current (flat or phase) rule set.
 */
export class MoveNotAllowed extends Schema.TaggedError<MoveNotAllowed>()(
	"swish/MoveNotAllowed",
	{ move: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * A move's `validate` rejected the input. Games raise this from `validate`.
 */
export class InvalidMove extends Schema.TaggedError<InvalidMove>()(
	"swish/InvalidMove",
	{ move: Schema.String, reason: Schema.String },
	{ httpApiStatus: 422 }
) {}

/**
 * No persisted state was found for this Durable Object (never initialised).
 */
export class GameNotFound extends Schema.TaggedError<GameNotFound>()(
	"swish/GameNotFound",
	{ id: GameId },
	{ httpApiStatus: 404 }
) {}

/**
 * The caller is not a seated player in this game. Every command except
 * `initialize`/`join` asserts membership from the authenticated identity, so a
 * non-member can neither read a private view nor act on a game they haven't joined.
 */
export class NotAMember extends Schema.TaggedError<NotAMember>()(
	"swish/NotAMember",
	{ playerId: PlayerId },
	{ httpApiStatus: 403 }
) {}

/**
 * A phased structure referenced a phase name that does not exist.
 */
export class PhaseNotFound extends Schema.TaggedError<PhaseNotFound>()(
	"swish/PhaseNotFound",
	{ phase: Schema.String }
) {}

/**
 * Persisted state failed to decode against the current schema.
 */
export class CorruptState extends Schema.TaggedError<CorruptState>()(
	"swish/CorruptState",
	{ id: Schema.optionalKey( GameId ), reason: Schema.String }
) {}

/**
 * `undo` was called but there is no move left to undo — either the game has not
 * started, or the cursor is already back at its opening position.
 * Undo is only possible after the game has started
 */
export class NothingToUndo extends Schema.TaggedError<NothingToUndo>()(
	"swish/NothingToUndo",
	{ cursor: Schema.Int },
	{ httpApiStatus: 409 }
) {}

/**
 * `redo` was called but the cursor is already at the newest commit.
 */
export class NothingToRedo extends Schema.TaggedError<NothingToRedo>()(
	"swish/NothingToRedo",
	{ cursor: Schema.Int },
	{ httpApiStatus: 409 }
) {}

/**
 * `undo` was refused because the commit at the cursor is not this player's move.
 * A player may only take back a move they played themselves, and only while it is
 * still the last thing that happened — anything committed on top of it
 * has to come off first, by whoever owns it.
 */
export class UndoNotAllowed extends Schema.TaggedError<UndoNotAllowed>()(
	"swish/UndoNotAllowed",
	{ playerId: PlayerId, cursor: Schema.Int },
	{ httpApiStatus: 403 }
) {}

/**
 * `redo` was refused because the commit ahead of the cursor is not this player's
 * move. Redo is undo's mirror: the move being replayed must belong to the player
 * asking for it.
 */
export class RedoNotAllowed extends Schema.TaggedError<RedoNotAllowed>()(
	"swish/RedoNotAllowed",
	{ playerId: PlayerId, cursor: Schema.Int },
	{ httpApiStatus: 403 }
) {}

/**
 * A seat cannot be handed over because the game declares no bot policy at all —
 * neither one for taking its turns nor one for answering the windows it is
 * asked. Nothing could act for the seat, so the request is refused rather than
 * recorded as a setting that does nothing.
 */
export class AutoPlayUnavailable extends Schema.TaggedError<AutoPlayUnavailable>()(
	"swish/AutoPlayUnavailable",
	{ game: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * A hint was asked for a question the game declares no policy to answer — the
 * turn in a game with no `botMove`, an open window in one with no `botRespond`.
 *
 * Narrower than `AutoPlayUnavailable`, which asks whether there is *any* policy
 * to hand a seat to. A hint is a question about one position, so what matters is
 * whether the policy for *that* question exists: a game that answers windows but
 * takes no turns of its own can hint about a window and nothing else.
 */
export class HintUnavailable extends Schema.TaggedError<HintUnavailable>()(
	"swish/HintUnavailable",
	{ game: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * A side was asked for in a game that declares none. Nothing could be assigned, so
 * the request is refused rather than recorded as a pick that means nothing.
 */
export class TeamsUnavailable extends Schema.TaggedError<TeamsUnavailable>()(
	"swish/TeamsUnavailable",
	{ game: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * The requested side is not one this game declares in `config.teams`.
 */
export class TeamNotFound extends Schema.TaggedError<TeamNotFound>()(
	"swish/TeamNotFound",
	{ team: Schema.String },
	{ httpApiStatus: 404 }
) {}

/**
 * The requested side already holds its share of the seats. Sides are equal-sized,
 * so taking one more would leave another short.
 */
export class TeamFull extends Schema.TaggedError<TeamFull>()(
	"swish/TeamFull",
	{ team: Schema.String, size: Schema.Number },
	{ httpApiStatus: 409 }
) {}

/**
 * The name offered for a side is not one `TeamName` accepts — empty, or past its
 * length cap. The HTTP layer decodes the payload before the engine sees it, so
 * this is the guard for a caller reaching the command directly.
 */
export class InvalidTeamName extends Schema.TaggedError<InvalidTeamName>()(
	"swish/InvalidTeamName",
	{ name: Schema.String },
	{ httpApiStatus: 422 }
) {}

/**
 * A side may only be named by someone playing on it.
 */
export class NotOnTeam extends Schema.TaggedError<NotOnTeam>()(
	"swish/NotOnTeam",
	{ playerId: PlayerId, team: Schema.String },
	{ httpApiStatus: 403 }
) {}

/**
 * That side already has a name. A name is chosen once and is not editable, so a
 * second attempt is refused rather than quietly replacing what is there.
 */
export class TeamAlreadyNamed extends Schema.TaggedError<TeamAlreadyNamed>()(
	"swish/TeamAlreadyNamed",
	{ team: Schema.String, name: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * The config declares teams the engine cannot seat: fewer than two sides,
 * duplicate ids, or a `playerCount` that does not divide evenly between them.
 * Raised by `initialize`, so a game that could never be seated is never stored.
 */
export class InvalidTeamConfig extends Schema.TaggedError<InvalidTeamConfig>()(
	"swish/InvalidTeamConfig",
	{ reason: Schema.String },
	{ httpApiStatus: 422 }
) {}

/**
 * An ordinary turn action was attempted while an interaction window is open. The
 * turn is suspended until the window settles, so the move is refused rather than
 * folded in ahead of a decision the table is still waiting on.
 *
 * Also what `undo` and `redo` answer while a window is open. Taking a move back
 * after seeing who challenged it — or who did not — would turn the history into
 * a way of asking the table a question for free, so the log is frozen until the
 * window closes.
 */
export class InteractionInProgress extends Schema.TaggedError<InteractionInProgress>()(
	"swish/InteractionInProgress",
	{ frameId: Schema.String, kind: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * A response — or a pass — arrived with no window open to receive it. Usually a
 * client acting on a view it has since been sent a replacement for.
 */
export class InteractionNotOpen extends Schema.TaggedError<InteractionNotOpen>()(
	"swish/InteractionNotOpen",
	{ playerId: PlayerId },
	{ httpApiStatus: 409 }
) {}

/**
 * A window is open, but not to this player with this move — they are not among
 * the responders it is waiting on, they have already answered, or the move is not
 * one of the options they were offered.
 */
export class NotRespondingTo extends Schema.TaggedError<NotRespondingTo>()(
	"swish/NotRespondingTo",
	{ playerId: PlayerId, frameId: Schema.String, move: Schema.optionalKey( Schema.String ) },
	{ httpApiStatus: 403 }
) {}

/**
 * A mandatory window cannot be declined. The decision it is asking for has to be
 * made by somebody, so the engine will make it before it lets the window go
 * unanswered — but it will not record the seat as having chosen to say nothing.
 */
export class PassNotAllowed extends Schema.TaggedError<PassNotAllowed>()(
	"swish/PassNotAllowed",
	{ frameId: Schema.String, kind: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * The window a response named is not the one that is open.
 *
 * The race this exists for is real and quick: a player is looking at a challenge
 * window as it settles, the game opens the next one in the same commit, and the
 * click that was meant for the first lands on the second. Naming the frame makes
 * that a refusal instead of an answer to a question they never read.
 */
export class InteractionStale extends Schema.TaggedError<InteractionStale>()(
	"swish/InteractionStale",
	{ expected: Schema.String, actual: Schema.optionalKey( Schema.String ) },
	{ httpApiStatus: 409 }
) {}

/**
 * A window was opened of a kind the structure does not declare, so there is no
 * `onResolve` to settle it with. A bug in the game rather than anything a caller
 * did — like `PhaseNotFound`, and carrying no HTTP status for the same reason.
 */
export class InteractionNotDeclared extends Schema.TaggedError<InteractionNotDeclared>()(
	"swish/InteractionNotDeclared",
	{ kind: Schema.String }
) {}

/**
 * A game's windows resolved into each other without stopping.
 *
 * Each `onResolve` may open the next question in a chain — a block that is
 * itself challenged — and the engine unwinds the stack in one commit. A chain
 * with no end would fold events until it ran out of memory, so there is a
 * ceiling on the depth, and reaching it means the rules cannot settle what they
 * opened.
 *
 * A bug in the game rather than anything a caller did — like
 * {@link InteractionNotDeclared}, and carrying no HTTP status for the same
 * reason. It is a typed failure rather than a defect quite deliberately: a
 * defect inside a cluster entity restarts it, and the restart redelivers the
 * very message that caused it, so the table would spin instead of stopping.
 */
export class InteractionCascade extends Schema.TaggedError<InteractionCascade>()(
	"swish/InteractionCascade",
	{ kind: Schema.String, depth: Schema.Int }
) {}

/**
 * A rematch was asked for on a game that has not finished. There is nothing to
 * play again yet, so the request is refused rather than quietly starting a
 * second game alongside one still in progress.
 */
export class RematchUnavailable extends Schema.TaggedError<RematchUnavailable>()(
	"swish/RematchUnavailable",
	{ status: Schema.String },
	{ httpApiStatus: 409 }
) {}


// --- Error Groups ----------------------------------------------------------

/**
 * Each command's errors are declared as an *array*, not a union, and the union
 * is derived from it.
 *
 * The array is what an HTTP endpoint must be given. `HttpApiEndpoint` resolves
 * one status per error schema it is handed, and a `Schema.Union` is one schema —
 * so a union'd group reports whatever the union itself is annotated with, which
 * is nothing, and every rule of every game comes back 500. Handed the members
 * instead, each keeps the status it declares.
 *
 * The unions are still what an `Rpc` takes, and what the error types are named
 * after, so both forms are exported and the array is the one that is written
 * down. Groups that build on other groups spread them, and repeat nothing: a
 * schema listed twice would be encoded twice for the same status.
 *
 * The two are named apart rather than overloaded: `XErrors` is the list, which
 * is what crosses HTTP, and `XError` is the one-of, which is what an `Rpc`
 * declares and what the failure channel is typed as. Deriving the second from
 * the first is what keeps them from drifting — there is one place a member is
 * added, and both forms follow.
 */

/**
 * The three refusals that mean the *game* is wrong, not the caller.
 *
 * A phase nothing declares, a window of a kind nothing declares, a chain of
 * windows that will not settle. None of them carries an HTTP status, because
 * none of them is something a client can do differently — they are bugs in a
 * game's rules, surfaced rather than swallowed so the entity stops instead of
 * restarting into the same fault.
 *
 * Spread into every group whose command can run a lifecycle hook, a phase entry
 * or an interaction tail, which between them is most of them.
 */
export const RulesErrors = [
	PhaseNotFound,
	InteractionNotDeclared,
	InteractionCascade
] as const;

/** The errors `getView` can surface to the client. */
export const GetViewErrors = [ NotAMember, GameNotFound, CorruptState ] as const;
export type GetViewError = typeof GetViewError.Type;
export const GetViewError = Schema.Union( GetViewErrors );

/** The errors `autoPlay` can surface to the client. */
export const AutoPlayErrors = [ ...GetViewErrors, AutoPlayUnavailable ] as const;
export type AutoPlayError = typeof AutoPlayError.Type;
export const AutoPlayError = Schema.Union( AutoPlayErrors );

/**
 * The errors `hint` can surface to the client.
 *
 * `GetViewErrors` because a hint is a read of the same game by the same rules —
 * but with `NotAMember` meaning rather more than it does there. `getView` answers
 * a stranger with the table's redacted view; a hint has no table-wide answer,
 * because the whole of what it computes is what *one seat* should play.
 *
 * The three refusals on top of it are the three ways of asking at the wrong
 * moment, kept apart because a client has something different to say for each: a
 * lobby or a finished game (`GameNotInProgress`), somebody else's turn
 * (`NotYourTurn`), and a window that is open but is not asking the caller
 * (`NotRespondingTo`).
 */
export const HintErrors = [
	...GetViewErrors,
	GameNotInProgress,
	NotYourTurn,
	NotRespondingTo,
	HintUnavailable
] as const;
export type HintError = typeof HintError.Type;
export const HintError = Schema.Union( HintErrors );

/** The errors `join` can surface to the client. */
export const JoinGameErrors = [
	GameFull,
	AlreadyJoined,
	GameNotJoinable,
	GameNotFound,
	CorruptState,

	// A join can be the one that fills the table, and `autoStart` turns that into
	// a `start` — hooks, opening phase and all.
	...RulesErrors
] as const;
export type JoinGameError = typeof JoinGameError.Type;
export const JoinGameError = Schema.Union( JoinGameErrors );

/**
 * The errors `spectate` can surface to the client.
 *
 * Deliberately shorter than `join`'s. `GameNotJoinable` is absent because a game
 * under way is the one most worth watching — refusing there would refuse the
 * feature — and `GameFull` because watching takes no seat, so there is nothing
 * to run out of. `NotAMember` is absent for the reason the whole feature exists:
 * not being a member is the normal case here, not a fault.
 *
 * `AlreadyJoined` is the one refusal, and it means what it says — a player who
 * holds a seat cannot also be in the audience. Asking twice is not an error; the
 * engine treats a repeat as the no-op it is.
 */
export const SpectateErrors = [ AlreadyJoined, GameNotFound, CorruptState ] as const;
export type SpectateError = typeof SpectateError.Type;
export const SpectateError = Schema.Union( SpectateErrors );

/**
 * The errors creating a game can surface to the client. `join`'s errors plus the
 * ones only `initialize` can raise, so a bad team config does not have to be
 * declared on every plain join.
 */
export const InitializeErrors = [ ...JoinGameErrors, InvalidTeamConfig ] as const;
export type InitializeError = typeof InitializeError.Type;
export const InitializeError = Schema.Union( InitializeErrors );

/** The errors `addBots` can surface to the client. */
export const AddBotsErrors = [ ...JoinGameErrors, NotAMember ] as const;
export type AddBotsError = typeof AddBotsError.Type;
export const AddBotsError = Schema.Union( AddBotsErrors );

/** The errors `joinTeam` can surface to the client. */
export const JoinTeamErrors = [
	NotAMember,
	TeamsUnavailable,
	TeamNotFound,
	TeamFull,
	GameNotJoinable,
	GameNotFound,
	CorruptState
] as const;
export type JoinTeamError = typeof JoinTeamError.Type;
export const JoinTeamError = Schema.Union( JoinTeamErrors );

/** The errors `nameTeam` can surface to the client. */
export const NameTeamErrors = [
	NotAMember,
	NotOnTeam,
	TeamAlreadyNamed,
	InvalidTeamName,
	TeamsUnavailable,
	TeamNotFound,
	GameNotJoinable,
	GameNotFound,
	CorruptState
] as const;
export type NameTeamError = typeof NameTeamError.Type;
export const NameTeamError = Schema.Union( NameTeamErrors );

/** The errors `start` can surface to the client. */
export const StartGameErrors = [
	NotAMember,
	CannotStart,
	AlreadyJoined,
	GameNotFound,
	CorruptState,
	...RulesErrors
] as const;
export type StartGameError = typeof StartGameError.Type;
export const StartGameError = Schema.Union( StartGameErrors );

/**
 * The errors a move can surface to the client.
 *
 * One group covers both kinds of move, because from the caller's side there is
 * only one kind: a move is submitted the same way whether it is a turn action or
 * an answer to an open window, and which of these comes back is how they find out
 * which the engine took it for.
 */
export const MoveErrors = [
	NotAMember,
	InvalidMove,
	NotYourTurn,
	MoveNotAllowed,
	GameNotInProgress,
	GameNotFound,
	CorruptState,
	InteractionInProgress,
	NotRespondingTo,
	InteractionStale,
	...RulesErrors
] as const;
export type MoveError = typeof MoveError.Type;
export const MoveError = Schema.Union( MoveErrors );

/**
 * The errors declining an interaction window can surface to the client.
 *
 * `GetViewErrors` is spread rather than listed alongside `NotAMember`, which it
 * already contains: as a union the repeat was invisible, but as an array it
 * would encode the same schema twice for the same status.
 */
export const PassErrors = [
	...GetViewErrors,
	GameNotInProgress,
	InteractionNotOpen,
	NotRespondingTo,
	PassNotAllowed,
	InteractionStale,
	...RulesErrors
] as const;
export type PassError = typeof PassError.Type;
export const PassError = Schema.Union( PassErrors );

/** The errors `undo` can surface to the client. */
export const UndoErrors = [
	...GetViewErrors,
	NothingToUndo,
	UndoNotAllowed,
	InteractionInProgress
] as const;
export type UndoError = typeof UndoError.Type;
export const UndoError = Schema.Union( UndoErrors );

/** The errors `redo` can surface to the client. */
export const RedoErrors = [
	...GetViewErrors,
	NothingToRedo,
	RedoNotAllowed,
	InteractionInProgress
] as const;
export type RedoError = typeof RedoError.Type;
export const RedoError = Schema.Union( RedoErrors );

/**
 * The errors `leaveTeam` can surface to the client. Stepping off a side you are
 * not on is not one of them: like `joinTeam` re-joining the side you already
 * hold, it is simply nothing happening.
 */
export const LeaveTeamErrors = [
	NotAMember,
	TeamsUnavailable,
	GameNotJoinable,
	GameNotFound,
	CorruptState
] as const;
export type LeaveTeamError = typeof LeaveTeamError.Type;
export const LeaveTeamError = Schema.Union( LeaveTeamErrors );

/**
 * The errors `rematch` can surface to the client.
 *
 * Deliberately narrow. Building the next game can fail in every way creating one
 * can — a config the engine refuses, a seat it will not take, a side with no
 * room — but none of those is a thing the caller did: the config and the roster
 * came from a game this same engine accepted and ran to completion, so a failure
 * there is a bug in the rematch, not a decision to report. Those are `orDie`d at
 * the handler, and what is left is the three things a caller can actually get
 * wrong — asking about a game that is not there, one they never sat at, or one
 * that has not finished.
 */
/**
 * The errors `rematch` can surface to the client.
 *
 * Creating the next table *is* an initialize, so everything an initialize can
 * refuse belongs here too — including a table that fills itself and starts into
 * a rule the game got wrong. Spelled out member by member rather than spread
 * from `InitializeErrors`, which repeats three of `GetViewErrors` and would
 * encode them twice for the same status.
 */
export const RematchErrors = [
	...GetViewErrors,
	...RulesErrors,
	GameFull,
	AlreadyJoined,
	GameNotJoinable,
	InvalidTeamConfig,
	RematchUnavailable
] as const;
export type RematchError = typeof RematchError.Type;
export const RematchError = Schema.Union( RematchErrors );
