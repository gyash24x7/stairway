// @s2h/swish/examples/counter-api — an Effect v4 HttpApi surface for the counter
// game. Companion to `./counter` (which builds the event-sourced `Engine`).
//
// This is the REST face of a swish game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + one endpoint per move + the
// additive undo/redo), each carrying a `:gameId` path param that selects which
// game instance to act on.
//
// It is deliberately HOST-AGNOSTIC. The handlers do not run the engine directly
// — the engine's `GameStore`/`EventStore`/`Scheduler` live inside a per-game
// Durable Object, unreachable from the Worker isolate. Instead they depend on
// the `CounterEngine` service tag (below), whose methods mirror the `Engine`
// interface with the host services already discharged (`R = never`). The Worker
// provides that service by resolving `gameId -> Durable Object stub`; leaving it
// unprovided here is exactly the "ready to plug in" seam. No `effect/unstable`
// Cloudflare imports, so this type-checks against `effect` alone.

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
} from "../errors";
import { GameCode, GameId, GameSnapshot, PlayerInfo } from "../schema";
import { AddInput, CounterConfig, CounterPlayer, CounterState, IncrementInput } from "./counter";

// --- Decoded shapes the service speaks -------------------------------------

type CounterConfigType = typeof CounterConfig.Type;
type IncrementInputType = typeof IncrementInput.Type;
type AddInputType = typeof AddInput.Type;
/** The snapshot returned by getState / undo / redo for this game. */
type CounterSnapshot = GameSnapshot<typeof CounterState.Type, typeof CounterPlayer.Type>;

// --- The abstract engine service (the plug-in seam) ------------------------
// Mirrors the counter `Engine` methods, but with the host services discharged
// (`R = never`) and a leading `gameId` selecting the instance. The Worker
// implements this by forwarding each call to the matching Durable Object stub.

export class CounterEngine extends Context.Service<CounterEngine, {
	readonly initialize: (
		gameId: GameId,
		payload: { readonly code: GameCode; readonly config: CounterConfigType }
	) => Effect.Effect<void>;
	readonly getState: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<CounterSnapshot, GameNotFound | CorruptState>;
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
	readonly increment: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: IncrementInputType
	) => Effect.Effect<void, MoveError>;
	readonly add: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: AddInputType
	) => Effect.Effect<void, MoveError>;
	readonly undo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<CounterSnapshot, NothingToUndo | GameNotFound | CorruptState>;
	readonly redo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<CounterSnapshot, NothingToRedo | GameNotFound | CorruptState>;
}>()( "counter/CounterEngine" ) {}

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/counter/:gameId/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors in `../rpc`. Void endpoints omit
// `success` (defaults to 204 No Content); getState/undo/redo return a snapshot.

const params = { gameId: GameId };
const CounterSnapshotSchema = GameSnapshot( CounterState, CounterPlayer );

const CounterGroup = HttpApiGroup.make( "counter" ).add(
	HttpApiEndpoint.post( "initialize", "/counter/:gameId/initialize", {
		params,
		payload: Schema.Struct( { code: GameCode, config: CounterConfig } )
	} ),
	HttpApiEndpoint.post( "getState", "/counter/:gameId/getState", {
		params,
		payload: PlayerInfo,
		success: CounterSnapshotSchema,
		error: Schema.Union( [ GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "join", "/counter/:gameId/join", {
		params,
		payload: PlayerInfo,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "addBots", "/counter/:gameId/addBots", {
		params,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "start", "/counter/:gameId/start", {
		params,
		error: Schema.Union( [ CannotStart, AlreadyJoined, GameNotFound, CorruptState, PhaseNotFound ] )
	} ),
	HttpApiEndpoint.post( "increment", "/counter/:gameId/increment", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: IncrementInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "add", "/counter/:gameId/add", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: AddInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "undo", "/counter/:gameId/undo", {
		params,
		payload: PlayerInfo,
		success: CounterSnapshotSchema,
		error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "redo", "/counter/:gameId/redo", {
		params,
		payload: PlayerInfo,
		success: CounterSnapshotSchema,
		error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
	} )
);

export class CounterApi extends HttpApi.make( "swish" ).add( CounterGroup ) {}

// --- The handler layer (residual requirement: `CounterEngine`) -------------
// Each handler pulls `CounterEngine` from context and forwards, threading the
// `:gameId` path param through. The produced layer is
// `Layer<ApiGroup, never, CounterEngine>` — the Worker plugs in the concrete
// `CounterEngine` (gameId -> DO stub) when it decides to serve this.

export const CounterApiLive = HttpApiBuilder.group( CounterApi, "counter", ( handlers ) =>
	handlers
		.handle( "initialize", ( { params, payload } ) =>
			Effect.flatMap( CounterEngine, ( engine ) => engine.initialize( params.gameId, payload ) ) )
		.handle( "getState", ( { params, payload } ) =>
			Effect.flatMap( CounterEngine, ( engine ) => engine.getState( params.gameId, payload ) ) )
		.handle( "join", ( { params, payload } ) =>
			Effect.flatMap( CounterEngine, ( engine ) => engine.join( params.gameId, payload ) ) )
		.handle( "addBots", ( { params } ) =>
			Effect.flatMap( CounterEngine, ( engine ) => engine.addBots( params.gameId ) ) )
		.handle( "start", ( { params } ) =>
			Effect.flatMap( CounterEngine, ( engine ) => engine.start( params.gameId ) ) )
		.handle( "increment", ( { params, payload } ) =>
			Effect.flatMap( CounterEngine, ( engine ) =>
				engine.increment( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "add", ( { params, payload } ) =>
			Effect.flatMap( CounterEngine, ( engine ) =>
				engine.add( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "undo", ( { params, payload } ) =>
			Effect.flatMap( CounterEngine, ( engine ) => engine.undo( params.gameId, payload ) ) )
		.handle( "redo", ( { params, payload } ) =>
			Effect.flatMap( CounterEngine, ( engine ) => engine.redo( params.gameId, payload ) ) ) );
