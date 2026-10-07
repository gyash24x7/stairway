import * as Schema from "effect/Schema";

import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";

import {
	AddBotsErrors,
	AutoPlayErrors,
	GetViewError,
	GetViewErrors,
	HintErrors,
	InitializeErrors,
	JoinGameErrors,
	JoinTeamErrors,
	LeaveTeamErrors,
	MoveErrors,
	NameTeamErrors,
	PassErrors,
	RedoErrors,
	RematchErrors,
	SpectateErrors,
	StartGameErrors,
	UndoErrors
} from "@/swish/errors";
import {
	AutoPlayInput,
	GameRef,
	GameView,
	Hint,
	JoinTeamInput,
	NameTeamInput,
	PassInteractionInput,
	RematchInput,
	RespondQuery
} from "@/swish/schema";

/**
 * Builds a first-class move endpoint: `POST /:gameId/<name>` whose payload is
 * the move's own `input` and whose error is the shared `MoveErrors`. `const Name`
 * keeps the move name a literal so it flows into the generated client type.
 *
 * For a turn action. A move that only ever answers an interaction window is
 * declared with {@link RespondApiEndpoint} instead — same command underneath,
 * one extra query parameter.
 *
 * @param name - The move name (becomes the path segment and endpoint id).
 * @param input - The move's input payload schema.
 * @returns The typed move endpoint.
 */
export const MoveApiEndpoint =
	<const Name extends string, Input extends Schema.Top>( name: Name, input: Input ) =>
		HttpApiEndpoint.post( name, `/:gameId/${ name }`, {
			params: GameRef,
			payload: input,
			error: MoveErrors
		} );

/**
 * Builds a move endpoint for a move that answers an interaction window:
 * `POST /:gameId/<name>?frame=<id>`.
 *
 * The same command as {@link MoveApiEndpoint} — the engine tells a response from
 * a turn action by whether a window is open, not by which endpoint was used — and
 * the same `MoveErrors`. What it adds is `frame`, which names the window the
 * caller believes it is answering.
 *
 * That parameter is worth its own builder because the race it closes is real and
 * fast: one answer can settle a window and open the next in the same commit, so a
 * click made against the first can land while the second is open. Naming the
 * frame turns that into `InteractionStale` rather than an answer to a question
 * the player never read. It is optional, for a caller that has no way to know
 * which window it is looking at — but a client rendering the window's own buttons
 * always does.
 *
 * @param name - The move name (becomes the path segment and endpoint id).
 * @param input - The move's input payload schema.
 * @returns The typed response endpoint.
 */
export const RespondApiEndpoint =
	<const Name extends string, Input extends Schema.Top>( name: Name, input: Input ) =>
		HttpApiEndpoint.post( name, `/:gameId/${ name }`, {
			params: GameRef,
			query: RespondQuery,
			payload: input,
			error: MoveErrors
		} );

/**
 * `POST /:gameId/pass` — decline the open interaction window.
 *
 * Engine-owned, so every game that opens windows gets one way of saying no
 * without declaring a move for it. Passing is one seat's answer and never the
 * table's: it takes the caller off the window and leaves it open for everybody
 * else. A window that cannot be declined answers `PassNotAllowed`.
 *
 * @returns The typed pass endpoint.
 */
export const PassApiEndpoint = () =>
	HttpApiEndpoint.post( "pass", "/:gameId/pass", {
		params: GameRef,
		payload: PassInteractionInput,
		error: PassErrors
	} );

/**
 * `POST /create` — create a new game, succeeding with a reference to it.
 * Parameterized by the schema for the input required to create this game.
 *
 * The payload is the game's own create input *plus* `isPrivate`, folded in
 * here rather than declared by each game. Visibility is the one creation
 * setting that is not a rule — it is asked identically wherever it is asked,
 * and the engine, not the game, is what acts on the answer. Adding it in the
 * builder is what keeps seven `CreateInput` schemas from each restating a
 * field none of them own, and means a game that forgets it cannot exist.
 *
 * Taking a `Schema.Struct` rather than any `Schema.Top` is what makes that
 * possible: the fields have to be spreadable to be extended. Every game's
 * create input already is one, down to `Schema.Struct( {} )`.
 *
 * @param input - The schema for input required to create this game.
 * @returns The typed create-game endpoint.
 */
export const CreateGameApiEndpoint = <Fields extends Schema.Struct.Fields>(
	input: Schema.Struct<Fields>
) =>
	HttpApiEndpoint.post( "createGame", "/create", {
		payload: Schema.Struct( { ...input.fields, isPrivate: Schema.Boolean } ),
		success: GameRef,
		error: InitializeErrors
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
			params: GameRef,
			success: GameView( view, config ),
			error: GetViewErrors
		} );

/**
 * `GET /:gameId/hint` — what the game's own policy would play for the caller's
 * seat, given exactly the view that seat is given.
 *
 * Engine-owned, like `pass` and `auto-play`: a game gets it by declaring a bot
 * policy at all rather than by writing anything for it, because the policy it
 * already declares *is* the answer. That is also what makes the hint honest —
 * it is the same function, reading the same redacted snapshot, that would take
 * the seat's turn if the seat were handed over.
 *
 * A read, and nothing more. It commits no event, moves neither `version` nor
 * `revision`, and is recorded nowhere, so nothing about a table changes because
 * somebody asked. Subscribers see no news, which is the intended behaviour
 * rather than an omission: who asked for help is the asker's business.
 *
 * Takes the same move name → input schema map the structure declares in
 * `schemas.moves`, so the suggestion crosses the wire as a discriminated union
 * over this game's actual moves rather than as a name and a blob.
 *
 * @param moves - The game's move name → input schema map.
 * @returns The typed hint endpoint.
 */
export const HintApiEndpoint = <Moves extends Schema.Struct.Fields>( moves: Moves ) =>
	HttpApiEndpoint.get( "hint", "/:gameId/hint", {
		params: GameRef,
		success: Hint( moves ),
		error: HintErrors
	} );

/**
 * `GET /:gameId/subscribe` — the same view as `getView`, as a live Server-Sent
 * Events stream: the game as the caller may see it now, and again after every
 * commit that changes it. Can surface get view errors both before the stream
 * is opened and after it it opened.
 *
 * @param view - The game's view schema.
 * @param config - The game's config schema.
 * @returns The typed subscribe endpoint.
 */
export const SubscribeApiEndpoint =
	<View extends Schema.Top, Config extends Schema.Top>( view: View, config: Config ) =>
		HttpApiEndpoint.get( "subscribe", "/:gameId/subscribe", {
			params: GameRef,
			// The union inside the stream and the array outside it. `StreamSse`
			// carries one error schema for the events it may end on; the endpoint
			// takes the members, so each keeps the status it declares. Same
			// errors, two shapes, for two different jobs.
			success: HttpApiSchema.StreamSse( {
				data: Schema.toCodecJson( GameView( view, config ) ),
				error: GetViewError
			} ),
			error: GetViewErrors
		} );

/**
 * `POST /:gameId/join` — take one of the table's free seats.
 *
 * No payload: the table is the path, and the player is the authenticated
 * identity, so there is nothing left to send. The game id doubles as the
 * invite — a link to this path is the whole of how somebody is asked to play.
 *
 * Joinable means `CREATED` and nothing else. A full table answers `GameFull`,
 * one already under way `GameNotJoinable`, and a second attempt by the same
 * player `AlreadyJoined` — three refusals rather than one, because a client
 * showing a join prompt has something different to say for each.
 *
 * @returns The typed join-game endpoint.
 */
export const JoinGameApiEndpoint = () =>
	HttpApiEndpoint.post( "joinGame", "/:gameId/join", {
		params: GameRef,
		error: JoinGameErrors
	} );

/**
 * `POST /:gameId/spectate` — watch a table you have no seat at.
 *
 * No payload, for the same reason `join` has none: the table is the path and the
 * watcher is the authenticated identity.
 *
 * This endpoint does not grant the *reading* of a game — the engine has always
 * answered a non-member with the table's redacted view, and still would without
 * it. What it does is put the caller on the record: it adds them to the live
 * audience every subscriber can see, and writes the row that says they were
 * here. A client asks for it once, and from then on the ordinary subscription
 * carries everything.
 *
 * Unlike `join` it takes no view of the game's status. A table that is full, or
 * half-played, or one move from over, is a table worth watching.
 *
 * @returns The typed spectate endpoint.
 */
export const SpectateApiEndpoint = () =>
	HttpApiEndpoint.post( "spectate", "/:gameId/spectate", {
		params: GameRef,
		error: SpectateErrors
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
		params: GameRef,
		payload: JoinTeamInput,
		error: JoinTeamErrors
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
		params: GameRef,
		payload: NameTeamInput,
		error: NameTeamErrors
	} );

/** `POST /:gameId/addBots` — fill the remaining seats with bots. */
export const AddBotsApiEndpoint = () =>
	HttpApiEndpoint.post( "addBots", "/:gameId/add-bots", {
		params: GameRef,
		error: AddBotsErrors
	} );

/**
 * `POST /:gameId/auto-play` — hand the caller's own seat to the game's `botMove`
 * policy, or take it back. The seat is read from the authenticated identity, so
 * a player can only switch their own. Autoplay is scheduling rather than state:
 * it never commits, so it survives undo and does not move the game's version.
 * Fails `AutoPlayUnavailable` when the game declares no policy to hand the seat
 * to, since there would be nothing to play it.
 *
 * @returns The typed auto-play endpoint.
 */
export const AutoPlayApiEndpoint = () =>
	HttpApiEndpoint.post( "autoPlay", "/:gameId/auto-play", {
		params: GameRef,
		payload: AutoPlayInput,
		error: AutoPlayErrors
	} );

/** `POST /:gameId/start` — start a filled game. */
export const StartGameApiEndpoint = () =>
	HttpApiEndpoint.post( "startGame", "/:gameId/start", {
		params: GameRef,
		error: StartGameErrors
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
		params: GameRef,
		error: UndoErrors
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
		params: GameRef,
		error: RedoErrors
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
		params: GameRef,
		error: LeaveTeamErrors
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
		params: GameRef,
		payload: RematchInput,
		success: GameRef,
		error: RematchErrors
	} );
