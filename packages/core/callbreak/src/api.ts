// @s2h/callbreak/api — an Effect v4 HttpApi surface for the Callbreak game.
//
// The REST face of the swish Callbreak game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + the `declareWins`/`playCard`
// moves + additive undo/redo), each carrying a `:gameId` path param selecting
// the game instance.
//
// Endpoint DEFINITIONS ONLY (no handlers/ApiLive/DO): the Worker provides the
// implementations when it decides to serve this. No `effect/unstable`
// Cloudflare imports, so this type-checks against `effect`.

import {
	AlreadyJoined,
	CannotStart,
	CorruptState,
	GameFull,
	GameNotFound,
	MoveError,
	NothingToRedo,
	NothingToUndo,
	PhaseNotFound
} from "@s2h/swish/errors";
import {
	GameIdParams,
	InitializeResponse,
	JoinGameInput,
	JoinGameResponse,
	PlayerInfo
} from "@s2h/swish/schema";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import {
	CallbreakConfig,
	CallbreakSnapshot,
	DeclareWinsInput,
	PlayCardInput
} from "./schema";

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/callbreak/...`. Success/payload/error schemas
// mirror the `EngineRpc` descriptors. Void endpoints omit `success` (defaults to
// 204 No Content); getState/undo/redo return a snapshot.

const CallbreakGroup = HttpApiGroup.make( "callbreak" )
	.prefix( "/callbreak" )
	.add(
		HttpApiEndpoint.post( "createGame", "/create", {
			payload: CallbreakConfig,
			success: InitializeResponse
		} ),
		HttpApiEndpoint.post( "getState", "/:gameId/getState", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: CallbreakSnapshot,
			error: Schema.Union( [ GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "join", "/join", {
			success: JoinGameResponse,
			payload: JoinGameInput,
			error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "addBots", "/:gameId/addBots", {
			params: GameIdParams,
			error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "start", "/:gameId/start", {
			params: GameIdParams,
			error: Schema.Union( [
				CannotStart,
				AlreadyJoined,
				GameNotFound,
				CorruptState,
				PhaseNotFound
			] )
		} ),
		HttpApiEndpoint.post( "declareWins", "/:gameId/declareWins", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: DeclareWinsInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "playCard", "/:gameId/playCard", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: PlayCardInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "undo", "/:gameId/undo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: CallbreakSnapshot,
			error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "redo", "/:gameId/redo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: CallbreakSnapshot,
			error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
		} )
	);

export class CallbreakApi extends HttpApi.make( "callbreak" ).add( CallbreakGroup ) {}
