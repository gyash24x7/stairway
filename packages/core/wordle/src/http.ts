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

import { Context, Effect, Schema } from "effect";
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
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
import { GameCode, GameId, GameSnapshot, PlayerInfo } from "@s2h/swish/schema";
import { GuessInput, WordleConfig, WordlePlayer, WordleShared } from "./swish";

// --- Decoded shapes the service speaks -------------------------------------

type WordleConfigType = typeof WordleConfig.Type;
type GuessInputType = typeof GuessInput.Type;
/** The snapshot returned by getState / undo / redo for this game. */
type WordleSnapshot = GameSnapshot<typeof WordleShared.Type, typeof WordlePlayer.Type>;

// --- The abstract engine service (the plug-in seam) ------------------------
// Mirrors the wordle `Engine` methods, but with the host services discharged
// (`R = never`) and a leading `gameId` selecting the instance. The Worker
// implements this by forwarding each call to the matching Durable Object stub.

export class WordleEngine extends Context.Service<WordleEngine, {
	readonly initialize: (
		gameId: GameId,
		payload: { readonly code: GameCode; readonly config: WordleConfigType }
	) => Effect.Effect<void>;
	readonly getState: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<WordleSnapshot, GameNotFound | CorruptState>;
	readonly join: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<void, GameFull | AlreadyJoined | GameNotFound | CorruptState>;
	readonly addBots: (
		gameId: GameId
	) => Effect.Effect<void, GameFull | AlreadyJoined | GameNotFound | CorruptState>;
	readonly start: (
		gameId: GameId
	) => Effect.Effect<void, CannotStart | AlreadyJoined | GameNotFound | CorruptState | PhaseNotFound>;
	readonly guess: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: GuessInputType
	) => Effect.Effect<void, MoveError>;
	readonly undo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<WordleSnapshot, NothingToUndo | GameNotFound | CorruptState>;
	readonly redo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<WordleSnapshot, NothingToRedo | GameNotFound | CorruptState>;
}>()( "wordle/WordleEngine" ) {}

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/wordle/:gameId/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const params = { gameId: GameId };
const WordleSnapshotSchema = GameSnapshot( WordleShared, WordlePlayer );

const WordleGroup = HttpApiGroup.make( "wordle" ).add(
	HttpApiEndpoint.post( "initialize", "/wordle/:gameId/initialize", {
		params,
		payload: Schema.Struct( { code: GameCode, config: WordleConfig } )
	} ),
	HttpApiEndpoint.post( "getState", "/wordle/:gameId/getState", {
		params,
		payload: PlayerInfo,
		success: WordleSnapshotSchema,
		error: Schema.Union( [ GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "join", "/wordle/:gameId/join", {
		params,
		payload: PlayerInfo,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "addBots", "/wordle/:gameId/addBots", {
		params,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "start", "/wordle/:gameId/start", {
		params,
		error: Schema.Union( [ CannotStart, AlreadyJoined, GameNotFound, CorruptState, PhaseNotFound ] )
	} ),
	HttpApiEndpoint.post( "guess", "/wordle/:gameId/guess", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: GuessInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "undo", "/wordle/:gameId/undo", {
		params,
		payload: PlayerInfo,
		success: WordleSnapshotSchema,
		error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "redo", "/wordle/:gameId/redo", {
		params,
		payload: PlayerInfo,
		success: WordleSnapshotSchema,
		error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
	} )
);

export class WordleApi extends HttpApi.make( "wordle" ).add( WordleGroup ) {}

// --- The handler layer (residual requirement: `WordleEngine`) --------------
// Each handler pulls `WordleEngine` from context and forwards, threading the
// `:gameId` path param through. The produced layer is
// `Layer<ApiGroup, never, WordleEngine>` — the Worker plugs in the concrete
// `WordleEngine` (gameId -> DO stub) when it decides to serve this.

export const WordleApiLive = HttpApiBuilder.group( WordleApi, "wordle", ( handlers ) =>
	handlers
		.handle( "initialize", ( { params, payload } ) =>
			Effect.flatMap( WordleEngine, ( engine ) => engine.initialize( params.gameId, payload ) ) )
		.handle( "getState", ( { params, payload } ) =>
			Effect.flatMap( WordleEngine, ( engine ) => engine.getState( params.gameId, payload ) ) )
		.handle( "join", ( { params, payload } ) =>
			Effect.flatMap( WordleEngine, ( engine ) => engine.join( params.gameId, payload ) ) )
		.handle( "addBots", ( { params } ) =>
			Effect.flatMap( WordleEngine, ( engine ) => engine.addBots( params.gameId ) ) )
		.handle( "start", ( { params } ) =>
			Effect.flatMap( WordleEngine, ( engine ) => engine.start( params.gameId ) ) )
		.handle( "guess", ( { params, payload } ) =>
			Effect.flatMap( WordleEngine, ( engine ) =>
				engine.guess( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "undo", ( { params, payload } ) =>
			Effect.flatMap( WordleEngine, ( engine ) => engine.undo( params.gameId, payload ) ) )
		.handle( "redo", ( { params, payload } ) =>
			Effect.flatMap( WordleEngine, ( engine ) => engine.redo( params.gameId, payload ) ) ) );
