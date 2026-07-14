// @s2h/splendor/api — an Effect v4 HttpApi surface for the Splendor game.
//
// The REST face of the swish Splendor game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + one endpoint per move + the
// additive undo/redo), each carrying a `:gameId` path param selecting the game
// instance.
//
// HOST-AGNOSTIC: endpoint definitions only. No handlers, no engine service, no
// Cloudflare imports — so this type-checks against `effect`. The Worker wires
// handlers to a resolved Durable Object stub elsewhere.

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
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorSnapshot
} from "./schema";

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/splendor/:gameId/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const SplendorGroup = HttpApiGroup.make( "splendor" )
	.prefix( "/splendor" )
	.add(
		HttpApiEndpoint.post( "createGame", "/create", {
			payload: SplendorConfig,
			success: InitializeResponse
		} ),
		HttpApiEndpoint.post( "getState", "/:gameId/getState", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: SplendorSnapshot,
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
		HttpApiEndpoint.post( "pickTokens", "/:gameId/pickTokens", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: PickTokensInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "reserveCard", "/:gameId/reserveCard", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: ReserveCardInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "purchaseCard", "/:gameId/purchaseCard", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: PurchaseCardInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "undo", "/:gameId/undo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: SplendorSnapshot,
			error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "redo", "/:gameId/redo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: SplendorSnapshot,
			error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
		} )
	);

export class SplendorApi extends HttpApi.make( "splendor" ).add( SplendorGroup ) {}
