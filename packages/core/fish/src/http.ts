// @s2h/fish/http — an Effect v4 HttpApi surface for Fish (Literature).
//
// The REST face of the swish Fish game: one `HttpApiGroup` whose endpoints
// mirror the game's RPCs (the shared lifecycle + one endpoint per move + the
// additive undo/redo), each carrying a `:gameId` path param that selects which
// game instance to act on.
//
// HOST-AGNOSTIC: the handlers do not run the engine directly — they depend on
// the `FishEngine` service tag (below), whose methods mirror the `Engine`
// interface with the host services already discharged (`R = never`) and a
// leading `gameId`. The Worker provides it by resolving `gameId -> Durable
// Object stub`. Mirrors `@s2h/swish/examples/counter-api`.

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
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishPlayer,
	FishShared,
	TransferTurnInput
} from "./swish";

// --- Decoded shapes the service speaks -------------------------------------

type FishConfigType = typeof FishConfig.Type;
type CreateTeamsInputType = typeof CreateTeamsInput.Type;
type AskCardInputType = typeof AskCardInput.Type;
type ClaimBookInputType = typeof ClaimBookInput.Type;
type TransferTurnInputType = typeof TransferTurnInput.Type;
/** The snapshot returned by getState / undo / redo for this game. */
type FishSnapshot = GameSnapshot<typeof FishShared.Type, typeof FishPlayer.Type>;

// --- The abstract engine service (the plug-in seam) ------------------------
// Mirrors the Fish `Engine` methods, but with the host services discharged
// (`R = never`) and a leading `gameId` selecting the instance. The Worker
// implements this by forwarding each call to the matching Durable Object stub.

export class FishEngine extends Context.Service<FishEngine, {
	readonly initialize: (
		gameId: GameId,
		payload: { readonly code: GameCode; readonly config: FishConfigType }
	) => Effect.Effect<void>;
	readonly getState: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<FishSnapshot, GameNotFound | CorruptState>;
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
	readonly createTeams: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: CreateTeamsInputType
	) => Effect.Effect<void, MoveError>;
	readonly askCard: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: AskCardInputType
	) => Effect.Effect<void, MoveError>;
	readonly claimBook: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: ClaimBookInputType
	) => Effect.Effect<void, MoveError>;
	readonly transferTurn: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: TransferTurnInputType
	) => Effect.Effect<void, MoveError>;
	readonly undo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<FishSnapshot, NothingToUndo | GameNotFound | CorruptState>;
	readonly redo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<FishSnapshot, NothingToRedo | GameNotFound | CorruptState>;
}>()( "fish/FishEngine" ) {}

// --- The HttpApi definition ------------------------------------------------
// Every endpoint is a POST under `/fish/:gameId/...`. Success/payload/error
// schemas mirror the `EngineRpc` descriptors. Void endpoints omit `success`
// (defaults to 204 No Content); getState/undo/redo return a snapshot.

const params = { gameId: GameId };
const FishSnapshotSchema = GameSnapshot( FishShared, FishPlayer );

const FishGroup = HttpApiGroup.make( "fish" ).add(
	HttpApiEndpoint.post( "initialize", "/fish/:gameId/initialize", {
		params,
		payload: Schema.Struct( { code: GameCode, config: FishConfig } )
	} ),
	HttpApiEndpoint.post( "getState", "/fish/:gameId/getState", {
		params,
		payload: PlayerInfo,
		success: FishSnapshotSchema,
		error: Schema.Union( [ GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "join", "/fish/:gameId/join", {
		params,
		payload: PlayerInfo,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "addBots", "/fish/:gameId/addBots", {
		params,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "start", "/fish/:gameId/start", {
		params,
		error: Schema.Union( [ CannotStart, AlreadyJoined, GameNotFound, CorruptState, PhaseNotFound ] )
	} ),
	HttpApiEndpoint.post( "createTeams", "/fish/:gameId/createTeams", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: CreateTeamsInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "askCard", "/fish/:gameId/askCard", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: AskCardInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "claimBook", "/fish/:gameId/claimBook", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: ClaimBookInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "transferTurn", "/fish/:gameId/transferTurn", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: TransferTurnInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "undo", "/fish/:gameId/undo", {
		params,
		payload: PlayerInfo,
		success: FishSnapshotSchema,
		error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "redo", "/fish/:gameId/redo", {
		params,
		payload: PlayerInfo,
		success: FishSnapshotSchema,
		error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
	} )
);

export class FishApi extends HttpApi.make( "fish" ).add( FishGroup ) {}

// --- The handler layer (residual requirement: `FishEngine`) ----------------
// Each handler pulls `FishEngine` from context and forwards, threading the
// `:gameId` path param through. Produces `Layer<ApiGroup, never, FishEngine>`.

export const FishApiLive = HttpApiBuilder.group( FishApi, "fish", ( handlers ) =>
	handlers
		.handle( "initialize", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) => engine.initialize( params.gameId, payload ) ) )
		.handle( "getState", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) => engine.getState( params.gameId, payload ) ) )
		.handle( "join", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) => engine.join( params.gameId, payload ) ) )
		.handle( "addBots", ( { params } ) =>
			Effect.flatMap( FishEngine, ( engine ) => engine.addBots( params.gameId ) ) )
		.handle( "start", ( { params } ) =>
			Effect.flatMap( FishEngine, ( engine ) => engine.start( params.gameId ) ) )
		.handle( "createTeams", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) =>
				engine.createTeams( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "askCard", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) =>
				engine.askCard( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "claimBook", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) =>
				engine.claimBook( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "transferTurn", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) =>
				engine.transferTurn( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "undo", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) => engine.undo( params.gameId, payload ) ) )
		.handle( "redo", ( { params, payload } ) =>
			Effect.flatMap( FishEngine, ( engine ) => engine.redo( params.gameId, payload ) ) ) );
