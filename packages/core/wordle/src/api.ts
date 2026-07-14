// @s2h/wordle/http — an Effect v4 HttpApi surface for the Wordle game.
//
// The REST face of the swish Wordle game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + the `guess` move + additive
// undo/redo), each carrying a `:gameId` path param selecting the game instance.
//
// HOST-AGNOSTIC: handlers do not run the engine directly — they depend on the
// `WordleEngine` service tag (whose methods mirror the `Engine` interface with
// host services discharged, `R = never`, and a leading `gameId`). The Worker
// provides that service by resolving `gameId -> Durable Object stub`. No
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
import { GuessInput, WordleConfig, WordleSnapshot } from "./schema";

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/wordle/:gameId/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const WordleSnapshotSchema = WordleSnapshot;

const WordleGroup = HttpApiGroup.make( "wordle" )
	.prefix( "/wordle" )
	.add(
		HttpApiEndpoint.post( "createGame", "/create", {
			payload: WordleConfig,
			success: InitializeResponse
		} ),
		HttpApiEndpoint.post( "getState", "/:gameId/getState", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: WordleSnapshotSchema,
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
		HttpApiEndpoint.post( "guess", "/:gameId/guess", {
			params: GameIdParams,
			payload: Schema.Struct( { playerInfo: PlayerInfo, input: GuessInput } ),
			error: MoveError
		} ),
		HttpApiEndpoint.post( "undo", "/:gameId/undo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: WordleSnapshotSchema,
			error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
		} ),
		HttpApiEndpoint.post( "redo", "/:gameId/redo", {
			params: GameIdParams,
			payload: PlayerInfo,
			success: WordleSnapshotSchema,
			error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
		} )
	);

export class WordleApi extends HttpApi.make( "wordle" ).add( WordleGroup ) {}