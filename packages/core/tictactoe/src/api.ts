// @s2h/tictactoe/api — an Effect v4 HttpApi surface for the Tic-Tac-Toe game.
//
// The REST face of the swish Tic-Tac-Toe game: one `HttpApiGroup` whose
// endpoints mirror the game's RPCs (the shared lifecycle + the `place` move +
// additive undo/redo), each carrying a `:gameId` path param selecting the game
// instance.
//
// HOST-AGNOSTIC: this module contains ONLY endpoint definitions — no handlers,
// no Durable Object import. No `effect/unstable` Cloudflare imports, so it
// type-checks against `effect`.

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
import { PlaceInput, TicTacToeConfig, TicTacToeSnapshot } from "./schema";

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/tic-tac-toe/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const TicTacToeGroup = HttpApiGroup.make( "tic-tac-toe" )
	.prefix( "/tic-tac-toe" )
	.add(
		HttpApiEndpoint.post( "createGame", "/create", {
			payload: TicTacToeConfig,
			success: InitializeResponse
		} ),
		HttpApiEndpoint.post( "getState", "/:gameId/getState", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: TicTacToeSnapshot,
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
		HttpApiEndpoint.post( "place", "/:gameId/place", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: PlaceInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "undo", "/:gameId/undo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: TicTacToeSnapshot,
			error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "redo", "/:gameId/redo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: TicTacToeSnapshot,
			error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
		} )
	);

export class TicTacToeApi extends HttpApi.make( "tic-tac-toe" ).add( TicTacToeGroup ) {}
