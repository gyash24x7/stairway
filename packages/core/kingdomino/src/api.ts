// @s2h/kingdomino/api — an Effect v4 HttpApi surface for the Kingdomino game.
//
// The REST face of the swish Kingdomino game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + the three moves + additive
// undo/redo), each carrying a `:gameId` path param selecting the game instance.
//
// DEFINITIONS ONLY — no handlers, no host wiring. Handlers do not run the engine
// directly; the Worker provides a concrete engine service by resolving
// `gameId -> Durable Object stub`. No `effect/unstable` Cloudflare imports, so
// this type-checks against `effect`.

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
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoSnapshot,
	PlaceDominoInput,
	SelectDominoInput
} from "./schema";

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/kingdomino/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const KingdominoGroup = HttpApiGroup.make( "kingdomino" )
	.prefix( "/kingdomino" )
	.add(
		HttpApiEndpoint.post( "createGame", "/create", {
			payload: KingdominoConfig,
			success: InitializeResponse
		} ),
		HttpApiEndpoint.post( "getState", "/:gameId/getState", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: KingdominoSnapshot,
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
		HttpApiEndpoint.post( "selectDomino", "/:gameId/selectDomino", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: SelectDominoInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "placeDomino", "/:gameId/placeDomino", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: PlaceDominoInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "discardDomino", "/:gameId/discardDomino", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: DiscardDominoInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "undo", "/:gameId/undo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: KingdominoSnapshot,
			error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "redo", "/:gameId/redo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: KingdominoSnapshot,
			error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
		} )
	);

export class KingdominoApi extends HttpApi.make( "kingdomino" ).add( KingdominoGroup ) {}
