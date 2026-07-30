import {
	Audience,
	GameIdParams,
	GameLog,
	InitializeResponse,
	JoinGameInput,
	JoinGameResponse,
	MovePayload,
	PlayerInfo
} from "@/shared/swish/schema.ts";
import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import { GetStateError, JoinError, MoveError, RedoError, StartError, UndoError } from "./errors.ts";

/**
 * Builds a first-class move endpoint: `POST /:gameId/<name>` whose payload is
 * `{ playerInfo, input }` and whose error is the shared `MoveError`. `const Name`
 * keeps the move name a literal so it flows into the generated client type.
 *
 * @param {string} name - The move name (becomes the path segment and endpoint id).
 * @param {Schema.Top} input - The move's input payload schema.
 * @returns The typed move endpoint.
 */
export const MoveApiEndpoint = <const Name extends string, Input extends Schema.Top>(
	name: Name,
	input: Input
) =>
	HttpApiEndpoint.post( name, `/:gameId/${ name }`, {
		params: GameIdParams,
		payload: MovePayload( input ),
		error: MoveError
	} );

/**
 * `POST /create` — create a new game from its `config`, succeeding with the new
 * game's id. Parameterized by the game's config schema (the request payload).
 *
 * @param {Schema.Top} config - The game's config schema.
 * @returns The typed create-game endpoint.
 */
export const CreateGameApiEndpoint = <Config extends Schema.Top>( config: Config ) =>
	HttpApiEndpoint.post( "createGame", "/create", {
		payload: config,
		success: InitializeResponse,
		error: JoinError
	} );

/**
 * `POST /:gameId/getState` — the audience-redacted game snapshot. Parameterized
 * by the game's snapshot schema (the success type).
 *
 * @param {Schema.Top} snapshot - The game's snapshot schema.
 * @returns The typed get-state endpoint.
 */
export const GetStateApiEndpoint = <Snapshot extends Schema.Top>( snapshot: Snapshot ) =>
	HttpApiEndpoint.post( "getState", "/:gameId/getState", {
		params: GameIdParams,
		payload: Audience,
		success: snapshot,
		error: GetStateError
	} );

/** `POST /:gameId/getLog` — the game's redacted, human-readable action feed. */
export const GetLogApiEndpoint = () =>
	HttpApiEndpoint.post( "getLog", "/:gameId/getLog", {
		params: GameIdParams,
		payload: Audience,
		success: GameLog,
		error: GetStateError
	} );

/** `POST /join` — seat a player by game code. */
export const JoinApiEndpoint = () =>
	HttpApiEndpoint.post( "join", "/join", {
		success: JoinGameResponse,
		payload: JoinGameInput,
		error: JoinError
	} );

/** `POST /:gameId/addBots` — fill the remaining seats with bots. */
export const AddBotsApiEndpoint = () =>
	HttpApiEndpoint.post( "addBots", "/:gameId/addBots", {
		params: GameIdParams,
		error: JoinError
	} );

/** `POST /:gameId/start` — start a filled game. */
export const StartApiEndpoint = () =>
	HttpApiEndpoint.post( "start", "/:gameId/start", {
		params: GameIdParams,
		error: StartError
	} );

/**
 * `POST /:gameId/undo` — step the log cursor back one commit and return the
 * rebuilt snapshot. Parameterized by the game's snapshot schema.
 *
 * @param {Schema.Top} snapshot - The game's snapshot schema.
 * @returns The typed undo endpoint.
 */
export const UndoApiEndpoint = <Snapshot extends Schema.Top>( snapshot: Snapshot ) =>
	HttpApiEndpoint.post( "undo", "/:gameId/undo", {
		params: GameIdParams,
		payload: PlayerInfo,
		success: snapshot,
		error: UndoError
	} );

/**
 * `POST /:gameId/redo` — step the log cursor forward one commit and return the
 * rebuilt snapshot. Parameterized by the game's snapshot schema.
 *
 * @param {Schema.Top} snapshot - The game's snapshot schema.
 * @returns The typed redo endpoint.
 */
export const RedoApiEndpoint = <Snapshot extends Schema.Top>( snapshot: Snapshot ) =>
	HttpApiEndpoint.post( "redo", "/:gameId/redo", {
		params: GameIdParams,
		payload: PlayerInfo,
		success: snapshot,
		error: RedoError
	} );
