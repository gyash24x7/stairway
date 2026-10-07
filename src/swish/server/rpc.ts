import * as Schema from "effect/Schema";

import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";

import {
	AddBotsError,
	AutoPlayError,
	GetViewError,
	HintError,
	InitializeError,
	JoinGameError,
	JoinTeamError,
	LeaveTeamError,
	MoveError,
	NameTeamError,
	PassError,
	RedoError,
	RematchError,
	SpectateError,
	StartGameError,
	UndoError
} from "@/swish/errors";
import {
	AutoPlayInput,
	GameId,
	GameRef,
	GameView,
	Hint,
	InitializeInput,
	JoinTeamInput,
	NameTeamInput,
	PassInteractionInput,
	PlayerInfo,
	PositiveInt,
	RematchInput,
	RematchPlan
} from "@/swish/schema";


export const makeSwishRpcs =
	<
		View extends Schema.Top,
		Config extends Schema.Top,
		Moves extends Schema.Struct.Fields
	>( view: View, config: Config, moves: Moves ) =>
		RpcGroup.make(
			Rpc.make( "initialize", {
				payload: { playerInfo: PlayerInfo, input: InitializeInput( config ) },
				error: InitializeError
			} ),
			Rpc.make( "joinGame", {
				payload: { playerInfo: PlayerInfo },
				error: JoinGameError
			} ),
			Rpc.make( "spectate", {
				payload: { playerInfo: PlayerInfo },
				error: SpectateError
			} ),
			Rpc.make( "addBots", { payload: { playerInfo: PlayerInfo }, error: AddBotsError } ),
			Rpc.make( "joinTeam", {
				payload: { playerInfo: PlayerInfo, input: JoinTeamInput },
				error: JoinTeamError
			} ),
			Rpc.make( "leaveTeam", {
				payload: { playerInfo: PlayerInfo },
				error: LeaveTeamError
			} ),
			Rpc.make( "nameTeam", {
				payload: { playerInfo: PlayerInfo, input: NameTeamInput },
				error: NameTeamError
			} ),
			Rpc.make( "startGame", { payload: { playerInfo: PlayerInfo }, error: StartGameError } ),

			/**
			 * Play the same people again.
			 *
			 * Answered with the reference to the next table, whether this call made
			 * it or found it already made: there is one rematch per game, and a
			 * whole table pressing the button at the same moment is the ordinary end
			 * of a game rather than a race to be refused. The entity runs one command
			 * at a time, which is the whole of what makes that true.
			 */
			Rpc.make( "rematch", {
				payload: { playerInfo: PlayerInfo, input: RematchInput },
				success: GameRef,
				error: RematchError
			} ),

			/**
			 * Lay this table out as somebody else's rematch.
			 *
			 * Internal, like `tick`: it carries no `playerInfo`, has no endpoint, and
			 * is only ever sent by the game being played again. It is the whole of
			 * creating the next table — the genesis, the sides and every seat — in
			 * one command, because the alternative is an initialize followed by a
			 * string of joins, and a table that fills itself would start somewhere in
			 * the middle of them with half its sides unassigned.
			 */
			Rpc.make( "inherit", {
				payload: {
					input: InitializeInput( config ),
					plan: RematchPlan,
					rematchOf: GameId
				},
				error: InitializeError
			} ),
			Rpc.make( "undo", { payload: { playerInfo: PlayerInfo }, error: UndoError } ),
			Rpc.make( "redo", { payload: { playerInfo: PlayerInfo }, error: RedoError } ),
			Rpc.make( "autoPlay", {
				payload: { playerInfo: PlayerInfo, input: AutoPlayInput },
				error: AutoPlayError
			} ),
			Rpc.make( "getView", {
				payload: { playerInfo: PlayerInfo },
				error: GetViewError,
				success: GameView( view, config )
			} ),

			/**
			 * What the game's own policy would play for the caller's seat.
			 *
			 * A read, alongside `getView` rather than among the commands: it runs no
			 * hook, emits no event and writes nothing, so a table is in exactly the
			 * position it was in before somebody asked.
			 *
			 * Carries `playerInfo` like every other outward-facing call, and that is
			 * the whole of who it can be asked about — the seat is the authenticated
			 * identity, and the snapshot the policy reads is built for that seat's
			 * audience. There is no payload for naming somebody else, because a hint
			 * computed from another seat's view would be a way of reading their hand.
			 */
			Rpc.make( "hint", {
				payload: { playerInfo: PlayerInfo },
				error: HintError,
				success: Hint( moves )
			} ),
			/**
			 * A move, whether it is a turn action or an answer to an open window.
			 *
			 * One command for both, because the engine can already tell them apart
			 * from the position: with a window open, a move the window lists is a
			 * response and anything else is refused. Splitting them would mean a
			 * client had to know which it was sending, and be wrong whenever the
			 * table moved on between the render and the click.
			 *
			 * `frameId` is what the client saw when it drew the button. Sent with a
			 * response and checked against the open window; ignored for a turn action,
			 * which is not answering anything.
			 */
			Rpc.make( "submitMove", {
				payload: Schema.Struct( {
					move: Schema.String,
					input: Schema.Unknown,
					frameId: Schema.optional( Schema.String ),
					playerInfo: PlayerInfo
				} ),
				error: MoveError
			} ),

			/**
			 * Declining an open interaction window. Engine-owned and generic, so a
			 * game gets it by opening windows at all rather than by declaring a move
			 * for it: every window that can be declined is declined the same way, and
			 * a pass carries nothing a game would need to interpret.
			 */
			Rpc.make( "pass", {
				payload: { playerInfo: PlayerInfo, input: PassInteractionInput },
				error: PassError
			} ),
			Rpc.make( "subscribe", {
				stream: true,
				payload: { playerInfo: PlayerInfo },
				success: GameView( view, config ),
				error: GetViewError
			} ),

			/**
			 * The turn clock coming due. Internal: it carries no `playerInfo`, has no
			 * endpoint in `endpoints.ts`, and is only ever sent by a game to itself.
			 *
			 * `version` is what the timer was armed against. A game that has moved on
			 * since — somebody got their move in, somebody took a move back — declines
			 * the tick rather than replaying a turn that already happened. Declining
			 * loses nothing: the write that moved the game armed the clock for the
			 * position it moved to.
			 *
			 * Declares no errors because nothing is listening. The timer sends this
			 * with `discard`, so a failure would have nowhere to go; everything a tick
			 * can run into — a bot policy with no answer, a move the rules refuse — is
			 * caught and logged where it happens.
			 */
			Rpc.make( "tick", { payload: { version: PositiveInt } } )
		);
