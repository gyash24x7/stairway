// @s2h/swish/api — the engine's HttpApi surface builder.
//
// Pure / browser-safe (schema only). The definition-side twin of `./rpc`
// (`EngineRpc`): `defineEngineApi` assembles a game's `HttpApiGroup` from the
// shared lifecycle endpoints (createGame/getState/join/addBots/start/undo/redo)
// plus its move endpoints, so each game's `api.ts` only supplies its slug,
// config/snapshot schemas, and moves. `moveEndpoint` builds one first-class move
// endpoint. Endpoint names/paths/schemas exactly mirror the `EngineRpc`
// descriptors, so the generated client surface is unchanged.

import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import { GetStateError, JoinError, MoveError, RedoError, StartError, UndoError } from "./errors";
import {
	Audience,
	GameIdParams,
	GameLog,
	InitializeResponse,
	JoinGameInput,
	JoinGameResponse,
	MovePayload,
	PlayerInfo
} from "./schema";

/**
 * A first-class move endpoint: `POST /:gameId/<name>` whose payload is
 * `{ playerInfo, input }` and whose error is the shared `MoveError`. `const Name`
 * keeps the move name a literal so it flows into the generated client type.
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
 * Assemble a game's `HttpApiGroup`: the shared engine lifecycle endpoints + the
 * game's move endpoints (built via `defineMoveEndpoint`). `const Slug`/`const Moves`
 * preserve the group name and move-name literals; the moves tuple is spread
 * among the fixed lifecycle endpoints, so `.add`'s `const A` inference keeps
 * every endpoint's exact type.
 */
export const GameApiGroup = <
	const Slug extends string,
	Config extends Schema.Top,
	Snapshot extends Schema.Top,
	const Moves extends ReadonlyArray<ReturnType<typeof MoveApiEndpoint>>
>(
	slug: Slug,
	options: { config: Config; snapshot: Snapshot; moves: Moves }
) =>
	HttpApiGroup.make( slug ).prefix( `/${ slug }` ).add(
		HttpApiEndpoint.post( "createGame", "/create", {
			payload: options.config,
			success: InitializeResponse
		} ),
		HttpApiEndpoint.post( "getState", "/:gameId/getState", {
			params: GameIdParams,
			payload: Audience,
			success: options.snapshot,
			error: GetStateError
		} ),
		HttpApiEndpoint.post( "getLog", "/:gameId/getLog", {
			params: GameIdParams,
			payload: Audience,
			success: GameLog,
			error: GetStateError
		} ),
		HttpApiEndpoint.post( "join", "/join", {
			success: JoinGameResponse,
			payload: JoinGameInput,
			error: JoinError
		} ),
		HttpApiEndpoint.post( "addBots", "/:gameId/addBots", {
			params: GameIdParams,
			error: JoinError
		} ),
		HttpApiEndpoint.post( "start", "/:gameId/start", {
			params: GameIdParams,
			error: StartError
		} ),
		...options.moves,
		HttpApiEndpoint.post( "undo", "/:gameId/undo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: options.snapshot,
			error: UndoError
		} ),
		HttpApiEndpoint.post( "redo", "/:gameId/redo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: options.snapshot,
			error: RedoError
		} )
	);
