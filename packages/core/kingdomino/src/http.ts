// @s2h/kingdomino/http — an Effect v4 HttpApi surface for Kingdomino.
//
// Companion to ./swish (which builds the event-sourced engine). This is the
// REST face of the game: one `HttpApiGroup` whose endpoints mirror the RPCs —
// the shared lifecycle + one endpoint per move + additive undo/redo — each
// carrying a `:gameId` path param selecting which game instance to act on.
//
// HOST-AGNOSTIC by design (mirrors the counter-api template). Handlers do not
// run the engine directly; they depend on the `KingdominoEngine` service tag,
// whose methods mirror the `Engine` interface with the host services already
// discharged (`R = never`) and a leading `gameId`. The Worker provides that
// service by resolving `gameId -> Durable Object stub`. No `effect/unstable`
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
} from "@s2h/swish/errors";
import { GameCode, GameId, GameSnapshot, PlayerInfo } from "@s2h/swish/schema";
import {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoPlayer,
	KingdominoShared,
	PlaceDominoInput,
	SelectDominoInput
} from "./swish";

// --- Decoded shapes the service speaks -------------------------------------

type KingdominoConfigType = typeof KingdominoConfig.Type;
type SelectDominoInputType = typeof SelectDominoInput.Type;
type PlaceDominoInputType = typeof PlaceDominoInput.Type;
type DiscardDominoInputType = typeof DiscardDominoInput.Type;
/** The snapshot returned by getState / undo / redo for this game. */
type KingdominoSnapshot = GameSnapshot<typeof KingdominoShared.Type, typeof KingdominoPlayer.Type>;

// --- The abstract engine service (the plug-in seam) ------------------------
// Mirrors the swish `Engine` methods, with host services discharged (`R = never`)
// and a leading `gameId` selecting the instance. The Worker implements this by
// forwarding each call to the matching Durable Object stub.

export class KingdominoEngine extends Context.Service<KingdominoEngine, {
	readonly initialize: (
		gameId: GameId,
		payload: { readonly code: GameCode; readonly config: KingdominoConfigType }
	) => Effect.Effect<void>;
	readonly getState: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<KingdominoSnapshot, GameNotFound | CorruptState>;
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
	readonly selectDomino: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: SelectDominoInputType
	) => Effect.Effect<void, MoveError>;
	readonly placeDomino: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: PlaceDominoInputType
	) => Effect.Effect<void, MoveError>;
	readonly discardDomino: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: DiscardDominoInputType
	) => Effect.Effect<void, MoveError>;
	readonly undo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<KingdominoSnapshot, NothingToUndo | GameNotFound | CorruptState>;
	readonly redo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<KingdominoSnapshot, NothingToRedo | GameNotFound | CorruptState>;
}>()( "kingdomino/KingdominoEngine" ) {}

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/kingdomino/:gameId/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const params = { gameId: GameId };
const KingdominoSnapshotSchema = GameSnapshot( KingdominoShared, KingdominoPlayer );

const KingdominoGroup = HttpApiGroup.make( "kingdomino" ).add(
	HttpApiEndpoint.post( "initialize", "/kingdomino/:gameId/initialize", {
		params,
		payload: Schema.Struct( { code: GameCode, config: KingdominoConfig } )
	} ),
	HttpApiEndpoint.post( "getState", "/kingdomino/:gameId/getState", {
		params,
		payload: PlayerInfo,
		success: KingdominoSnapshotSchema,
		error: Schema.Union( [ GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "join", "/kingdomino/:gameId/join", {
		params,
		payload: PlayerInfo,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "addBots", "/kingdomino/:gameId/addBots", {
		params,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "start", "/kingdomino/:gameId/start", {
		params,
		error: Schema.Union( [ CannotStart, AlreadyJoined, GameNotFound, CorruptState, PhaseNotFound ] )
	} ),
	HttpApiEndpoint.post( "selectDomino", "/kingdomino/:gameId/selectDomino", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: SelectDominoInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "placeDomino", "/kingdomino/:gameId/placeDomino", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: PlaceDominoInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "discardDomino", "/kingdomino/:gameId/discardDomino", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: DiscardDominoInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "undo", "/kingdomino/:gameId/undo", {
		params,
		payload: PlayerInfo,
		success: KingdominoSnapshotSchema,
		error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "redo", "/kingdomino/:gameId/redo", {
		params,
		payload: PlayerInfo,
		success: KingdominoSnapshotSchema,
		error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
	} )
);

export class KingdominoApi extends HttpApi.make( "kingdomino" ).add( KingdominoGroup ) {}

// --- The handler layer (residual requirement: `KingdominoEngine`) ----------
// Each handler pulls `KingdominoEngine` from context and forwards, threading the
// `:gameId` path param through. The produced layer is
// `Layer<ApiGroup, never, KingdominoEngine>` — the Worker plugs in the concrete
// `KingdominoEngine` (gameId -> DO stub) when it decides to serve this.

export const KingdominoApiLive = HttpApiBuilder.group( KingdominoApi, "kingdomino", ( handlers ) =>
	handlers
		.handle( "initialize", ( { params, payload } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) => engine.initialize( params.gameId, payload ) ) )
		.handle( "getState", ( { params, payload } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) => engine.getState( params.gameId, payload ) ) )
		.handle( "join", ( { params, payload } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) => engine.join( params.gameId, payload ) ) )
		.handle( "addBots", ( { params } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) => engine.addBots( params.gameId ) ) )
		.handle( "start", ( { params } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) => engine.start( params.gameId ) ) )
		.handle( "selectDomino", ( { params, payload } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) =>
				engine.selectDomino( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "placeDomino", ( { params, payload } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) =>
				engine.placeDomino( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "discardDomino", ( { params, payload } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) =>
				engine.discardDomino( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "undo", ( { params, payload } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) => engine.undo( params.gameId, payload ) ) )
		.handle( "redo", ( { params, payload } ) =>
			Effect.flatMap( KingdominoEngine, ( engine ) => engine.redo( params.gameId, payload ) ) ) );
