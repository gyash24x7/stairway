// @s2h/fish/api — an Effect v4 HttpApi surface for Fish (Literature).
//
// The REST face of the swish Fish game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + one endpoint per move + the
// additive undo/redo), each carrying a `:gameId` path param selecting the game
// instance.
//
// HOST-AGNOSTIC: endpoint DEFINITIONS only — no handlers, no `ApiLive`, no
// Durable Object imports. The Worker provides the implementation elsewhere. No
// `effect/unstable` Cloudflare imports, so this type-checks against `effect`.

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
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishSnapshot,
	TransferTurnInput
} from "./schema";
import { GAME_NAME } from "./utils";

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/fish/:gameId/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const FishGroup = HttpApiGroup.make( GAME_NAME )
	.prefix( `/${ GAME_NAME }` )
	.add(
		HttpApiEndpoint.post( "createGame", "/create", {
			payload: FishConfig,
			success: InitializeResponse
		} ),
		HttpApiEndpoint.post( "getState", "/:gameId/getState", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: FishSnapshot,
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
		HttpApiEndpoint.post( "createTeams", "/:gameId/createTeams", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: CreateTeamsInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "askCard", "/:gameId/askCard", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: AskCardInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "claimBook", "/:gameId/claimBook", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: ClaimBookInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "transferTurn", "/:gameId/transferTurn", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: TransferTurnInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "undo", "/:gameId/undo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: FishSnapshot,
			error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "redo", "/:gameId/redo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: FishSnapshot,
			error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
		} )
	);

export class FishApi extends HttpApi.make( GAME_NAME ).add( FishGroup ) {}
