// @s2h/splendor/http — an Effect v4 HttpApi surface for Splendor.
//
// The REST face of the swish Splendor game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + one endpoint per move + the
// additive undo/redo), each carrying a `:gameId` path param selecting which game
// instance to act on. Mirrors `@s2h/swish/examples/counter-api`.
//
// Host-agnostic: handlers depend on the `SplendorEngine` service tag (below),
// whose methods mirror the `Engine` interface with the host services discharged
// (`R = never`) and a leading `gameId`. The Worker provides that service by
// resolving `gameId -> Durable Object stub`.

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
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig,
	SplendorPlayer,
	SplendorShared
} from "./swish";

// --- Decoded shapes the service speaks -------------------------------------

type SplendorConfigType = typeof SplendorConfig.Type;
type PickTokensInputType = typeof PickTokensInput.Type;
type ReserveCardInputType = typeof ReserveCardInput.Type;
type PurchaseCardInputType = typeof PurchaseCardInput.Type;
/** The snapshot returned by getState / undo / redo for this game. */
type SplendorSnapshot = GameSnapshot<typeof SplendorShared.Type, typeof SplendorPlayer.Type>;

// --- The abstract engine service (the plug-in seam) ------------------------
// Mirrors the Splendor `Engine` methods, host services discharged (`R = never`)
// and a leading `gameId`. The Worker forwards each call to the matching DO stub.

export class SplendorEngine extends Context.Service<SplendorEngine, {
	readonly initialize: (
		gameId: GameId,
		payload: { readonly code: GameCode; readonly config: SplendorConfigType }
	) => Effect.Effect<void>;
	readonly getState: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<SplendorSnapshot, GameNotFound | CorruptState>;
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
	readonly pickTokens: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: PickTokensInputType
	) => Effect.Effect<void, MoveError>;
	readonly reserveCard: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: ReserveCardInputType
	) => Effect.Effect<void, MoveError>;
	readonly purchaseCard: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: PurchaseCardInputType
	) => Effect.Effect<void, MoveError>;
	readonly undo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<SplendorSnapshot, NothingToUndo | GameNotFound | CorruptState>;
	readonly redo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<SplendorSnapshot, NothingToRedo | GameNotFound | CorruptState>;
}>()( "splendor/SplendorEngine" ) {}

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/splendor/:gameId/...`. Void endpoints omit
// `success` (204 No Content); getState/undo/redo return a snapshot.

const params = { gameId: GameId };
const SplendorSnapshotSchema = GameSnapshot( SplendorShared, SplendorPlayer );

const SplendorGroup = HttpApiGroup.make( "splendor" ).add(
	HttpApiEndpoint.post( "initialize", "/splendor/:gameId/initialize", {
		params,
		payload: Schema.Struct( { code: GameCode, config: SplendorConfig } )
	} ),
	HttpApiEndpoint.post( "getState", "/splendor/:gameId/getState", {
		params,
		payload: PlayerInfo,
		success: SplendorSnapshotSchema,
		error: Schema.Union( [ GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "join", "/splendor/:gameId/join", {
		params,
		payload: PlayerInfo,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "addBots", "/splendor/:gameId/addBots", {
		params,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "start", "/splendor/:gameId/start", {
		params,
		error: Schema.Union( [ CannotStart, AlreadyJoined, GameNotFound, CorruptState, PhaseNotFound ] )
	} ),
	HttpApiEndpoint.post( "pickTokens", "/splendor/:gameId/pickTokens", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: PickTokensInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "reserveCard", "/splendor/:gameId/reserveCard", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: ReserveCardInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "purchaseCard", "/splendor/:gameId/purchaseCard", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: PurchaseCardInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "undo", "/splendor/:gameId/undo", {
		params,
		payload: PlayerInfo,
		success: SplendorSnapshotSchema,
		error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "redo", "/splendor/:gameId/redo", {
		params,
		payload: PlayerInfo,
		success: SplendorSnapshotSchema,
		error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
	} )
);

export class SplendorApi extends HttpApi.make( "splendor" ).add( SplendorGroup ) {}

// --- The handler layer (residual requirement: `SplendorEngine`) ------------

export const SplendorApiLive = HttpApiBuilder.group( SplendorApi, "splendor", ( handlers ) =>
	handlers
		.handle( "initialize", ( { params, payload } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) => engine.initialize( params.gameId, payload ) ) )
		.handle( "getState", ( { params, payload } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) => engine.getState( params.gameId, payload ) ) )
		.handle( "join", ( { params, payload } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) => engine.join( params.gameId, payload ) ) )
		.handle( "addBots", ( { params } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) => engine.addBots( params.gameId ) ) )
		.handle( "start", ( { params } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) => engine.start( params.gameId ) ) )
		.handle( "pickTokens", ( { params, payload } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) =>
				engine.pickTokens( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "reserveCard", ( { params, payload } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) =>
				engine.reserveCard( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "purchaseCard", ( { params, payload } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) =>
				engine.purchaseCard( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "undo", ( { params, payload } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) => engine.undo( params.gameId, payload ) ) )
		.handle( "redo", ( { params, payload } ) =>
			Effect.flatMap( SplendorEngine, ( engine ) => engine.redo( params.gameId, payload ) ) ) );
