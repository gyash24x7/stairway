import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";

import type * as Schema from "effect/Schema";

import {
	AutoPlayError,
	GameIdParams,
	GameRef,
	GameView,
	GetStateError,
	InitializeError,
	JoinError,
	JoinGameInput,
	JoinTeamInput,
	LeaveTeamError,
	MoveError,
	NameTeamError,
	NameTeamInput,
	RedoError,
	RematchError,
	RematchInput,
	SetAutoPlayInput,
	StartError,
	TeamError,
	UndoError
} from "@/swish/shared/schema.ts";

/**
 * Builds a first-class move endpoint: `POST /:gameId/<name>` whose payload is
 * the move's own `input` and whose error is the shared `MoveError`. `const Name`
 * keeps the move name a literal so it flows into the generated client type.
 *
 * @param name - The move name (becomes the path segment and endpoint id).
 * @param input - The move's input payload schema.
 * @returns The typed move endpoint.
 */
export const MoveApiEndpoint =
	<const Name extends string, Input extends Schema.Top>( name: Name, input: Input ) =>
		HttpApiEndpoint.post( name, `/:gameId/${ name }`, {
			params: GameIdParams,
			payload: input,
			error: MoveError
		} );

/**
 * `POST /create` — create a new game, succeeding with a reference to it.
 * Parameterized by the schema for the input required to create this game.
 *
 * Its error is wider than a plain join's: creating is the only moment the engine
 * sees a fresh config, so it is the only one that can refuse a set of teams it
 * could never seat.
 *
 * @param input - The schema for input required to create this game.
 * @returns The typed create-game endpoint.
 */
export const CreateGameApiEndpoint = <Input extends Schema.Top>( input: Input ) =>
	HttpApiEndpoint.post( "createGame", "/create", {
		payload: input,
		success: GameRef,
		error: InitializeError
	} );

/**
 * `GET /:gameId/view` — Returns the game as the caller is allowed to see it.
 * The engine picks the audience from the authenticated identity: a seated
 * player gets their own view, anyone else gets the table's.
 *
 * @param view - The game's view schema.
 * @param config - The game's config schema.
 * @returns The typed get view endpoint.
 */
export const GetViewApiEndpoint =
	<View extends Schema.Top, Config extends Schema.Top>( view: View, config: Config ) =>
		HttpApiEndpoint.get( "getView", "/:gameId/view", {
			params: GameIdParams,
			success: GameView( view, config ),
			error: GetStateError
		} );

/** `POST /join` — seat a player by game code. */
export const JoinApiEndpoint = () =>
	HttpApiEndpoint.post( "join", "/join", {
		success: GameRef,
		payload: JoinGameInput,
		error: JoinError
	} );

/**
 * `POST /:gameId/team` — take a side, or move to another one. The seat is read
 * from the authenticated identity, so a player can only assign their own. Legal
 * only before the game starts: the seating order is built from the sides, so
 * changing one afterwards would reshuffle the table mid-game.
 *
 * Note that with `autoStart` the lobby only lasts a few seconds once the last seat
 * fills, which is rarely long enough to pick a side deliberately — a team game
 * usually wants to be started by hand.
 *
 * @returns The typed join-team endpoint.
 */
export const JoinTeamApiEndpoint = () =>
	HttpApiEndpoint.post( "joinTeam", "/:gameId/team", {
		params: GameIdParams,
		payload: JoinTeamInput,
		error: TeamError
	} );

/**
 * `POST /:gameId/team/name` — name the caller's own side. The side is named once
 * and never renamed, so the first of its members to ask is the one who chooses;
 * everyone after them fails `TeamAlreadyNamed`. Naming someone else's side fails
 * `NotOnTeam`, and like the rest of team formation it is legal only before the
 * game starts.
 *
 * @returns The typed name-team endpoint.
 */
export const NameTeamApiEndpoint = () =>
	HttpApiEndpoint.post( "nameTeam", "/:gameId/team/name", {
		params: GameIdParams,
		payload: NameTeamInput,
		error: NameTeamError
	} );

/** `POST /:gameId/addBots` — fill the remaining seats with bots. */
export const AddBotsApiEndpoint = () =>
	HttpApiEndpoint.post( "addBots", "/:gameId/add-bots", {
		params: GameIdParams,
		error: JoinError
	} );

/**
 * `POST /:gameId/auto-play` — hand the caller's own seat to the game's `botMove`
 * policy, or take it back. The seat is read from the authenticated identity, so
 * a player can only switch their own. Autoplay is scheduling rather than state:
 * it never commits, so it survives undo and does not move the game's version.
 * Fails `AutoPlayUnavailable` when the game declares no policy to hand the seat
 * to, since there would be nothing to play it.
 *
 * @returns The typed set-auto-play endpoint.
 */
export const SetAutoPlayApiEndpoint = () =>
	HttpApiEndpoint.post( "setAutoPlay", "/:gameId/auto-play", {
		params: GameIdParams,
		payload: SetAutoPlayInput,
		error: AutoPlayError
	} );

/** `POST /:gameId/start` — start a filled game. */
export const StartApiEndpoint = () =>
	HttpApiEndpoint.post( "start", "/:gameId/start", {
		params: GameIdParams,
		error: StartError
	} );

/**
 * `POST /:gameId/undo` — step the log cursor back one move. Only moves are
 * undoable, and only once the game has started; otherwise fails `NothingToUndo`.
 * The caller may only take back their own move, and only while it is still the
 * newest commit — anything played on top of it fails `UndoNotAllowed`.
 *
 * @returns The typed undo endpoint.
 */
export const UndoApiEndpoint = () =>
	HttpApiEndpoint.post( "undo", "/:gameId/undo", {
		params: GameIdParams,
		error: UndoError
	} );

/**
 * `POST /:gameId/redo` — step the log cursor forward one commit, replaying a
 * move that was undone. The move being replayed must be the caller's own;
 * otherwise fails `RedoNotAllowed`.
 *
 * @returns The typed redo endpoint.
 */
export const RedoApiEndpoint = () =>
	HttpApiEndpoint.post( "redo", "/:gameId/redo", {
		params: GameIdParams,
		error: RedoError
	} );

/**
 * `POST /:gameId/team/leave` — step off the caller's own side, leaving their
 * seat unassigned. The way out of a full side: sides are equal-sized, so a seat
 * can only move somewhere with room, and a table whose sides are all full — a
 * rematch that carried them over, say — could otherwise never rearrange itself.
 * Leaving a side the caller does not hold does nothing rather than failing, and
 * like the rest of team formation it is legal only before the game starts.
 *
 * @returns The typed leave-team endpoint.
 */
export const LeaveTeamApiEndpoint = () =>
	HttpApiEndpoint.post( "leaveTeam", "/:gameId/team/leave", {
		params: GameIdParams,
		error: LeaveTeamError
	} );

/**
 * `POST /:gameId/rematch` — play the same people again.
 *
 * Only a member of a *finished* game may ask. The new game is this one's config
 * over this one's roster: every seat, bots included, is taken in the order it
 * sat here, so nobody has to be invited and no code has to be read out. The
 * caller's `keepTeams` decides whether the sides come with them.
 *
 * There is exactly one rematch per game, and asking again is answered with the
 * one that exists rather than refused — a whole table pressing the button at
 * once is the ordinary end of a game, and everybody should land at the same one.
 *
 * @returns The typed rematch endpoint.
 */
export const RematchApiEndpoint = () =>
	HttpApiEndpoint.post( "rematch", "/:gameId/rematch", {
		params: GameIdParams,
		payload: RematchInput,
		success: GameRef,
		error: RematchError
	} );
