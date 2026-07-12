// @s2h/callbreak/http — an Effect v4 HttpApi surface for the Callbreak game.
//
// The REST face of the swish Callbreak game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + the `declareWins`/`playCard`
// moves + additive undo/redo), each carrying a `:gameId` path param selecting
// the game instance.
//
// HOST-AGNOSTIC: handlers do not run the engine directly — they depend on the
// `CallbreakEngine` service tag (whose methods mirror the `Engine` interface
// with host services discharged, `R = never`, and a leading `gameId`). The
// Worker provides that service by resolving `gameId -> Durable Object stub`. No
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
import {
	CallbreakConfig,
	CallbreakPlayer,
	CallbreakShared,
	DeclareWinsInput,
	PlayCardInput
} from "./swish";

// --- Decoded shapes the service speaks -------------------------------------

type CallbreakConfigType = typeof CallbreakConfig.Type;
type DeclareWinsInputType = typeof DeclareWinsInput.Type;
type PlayCardInputType = typeof PlayCardInput.Type;
/** The snapshot returned by getState / undo / redo for this game. */
type CallbreakSnapshot = GameSnapshot<typeof CallbreakShared.Type, typeof CallbreakPlayer.Type>;

// --- The abstract engine service (the plug-in seam) ------------------------
// Mirrors the callbreak `Engine` methods, but with the host services discharged
// (`R = never`) and a leading `gameId` selecting the instance. The Worker
// implements this by forwarding each call to the matching Durable Object stub.

export class CallbreakEngine extends Context.Service<CallbreakEngine, {
	readonly initialize: (
		gameId: GameId,
		payload: { readonly code: GameCode; readonly config: CallbreakConfigType }
	) => Effect.Effect<void>;
	readonly getState: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<CallbreakSnapshot, GameNotFound | CorruptState>;
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
	readonly declareWins: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: DeclareWinsInputType
	) => Effect.Effect<void, MoveError>;
	readonly playCard: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: PlayCardInputType
	) => Effect.Effect<void, MoveError>;
	readonly undo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<CallbreakSnapshot, NothingToUndo | GameNotFound | CorruptState>;
	readonly redo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<CallbreakSnapshot, NothingToRedo | GameNotFound | CorruptState>;
}>()( "callbreak/CallbreakEngine" ) {}

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/callbreak/:gameId/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const params = { gameId: GameId };
const CallbreakSnapshotSchema = GameSnapshot( CallbreakShared, CallbreakPlayer );

const CallbreakGroup = HttpApiGroup.make( "callbreak" ).add(
	HttpApiEndpoint.post( "initialize", "/callbreak/:gameId/initialize", {
		params,
		payload: Schema.Struct( { code: GameCode, config: CallbreakConfig } )
	} ),
	HttpApiEndpoint.post( "getState", "/callbreak/:gameId/getState", {
		params,
		payload: PlayerInfo,
		success: CallbreakSnapshotSchema,
		error: Schema.Union( [ GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "join", "/callbreak/:gameId/join", {
		params,
		payload: PlayerInfo,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "addBots", "/callbreak/:gameId/addBots", {
		params,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "start", "/callbreak/:gameId/start", {
		params,
		error: Schema.Union( [ CannotStart, AlreadyJoined, GameNotFound, CorruptState, PhaseNotFound ] )
	} ),
	HttpApiEndpoint.post( "declareWins", "/callbreak/:gameId/declareWins", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: DeclareWinsInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "playCard", "/callbreak/:gameId/playCard", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: PlayCardInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "undo", "/callbreak/:gameId/undo", {
		params,
		payload: PlayerInfo,
		success: CallbreakSnapshotSchema,
		error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "redo", "/callbreak/:gameId/redo", {
		params,
		payload: PlayerInfo,
		success: CallbreakSnapshotSchema,
		error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
	} )
);

export class CallbreakApi extends HttpApi.make( "callbreak" ).add( CallbreakGroup ) {}

// --- The handler layer (residual requirement: `CallbreakEngine`) -----------
// Each handler pulls `CallbreakEngine` from context and forwards, threading the
// `:gameId` path param through. The produced layer is
// `Layer<ApiGroup, never, CallbreakEngine>` — the Worker plugs in the concrete
// `CallbreakEngine` (gameId -> DO stub) when it decides to serve this.

export const CallbreakApiLive = HttpApiBuilder.group( CallbreakApi, "callbreak", ( handlers ) =>
	handlers
		.handle( "initialize", ( { params, payload } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) => engine.initialize( params.gameId, payload ) ) )
		.handle( "getState", ( { params, payload } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) => engine.getState( params.gameId, payload ) ) )
		.handle( "join", ( { params, payload } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) => engine.join( params.gameId, payload ) ) )
		.handle( "addBots", ( { params } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) => engine.addBots( params.gameId ) ) )
		.handle( "start", ( { params } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) => engine.start( params.gameId ) ) )
		.handle( "declareWins", ( { params, payload } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) =>
				engine.declareWins( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "playCard", ( { params, payload } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) =>
				engine.playCard( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "undo", ( { params, payload } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) => engine.undo( params.gameId, payload ) ) )
		.handle( "redo", ( { params, payload } ) =>
			Effect.flatMap( CallbreakEngine, ( engine ) => engine.redo( params.gameId, payload ) ) ) );
