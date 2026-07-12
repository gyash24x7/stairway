// @s2h/tictactoe/http — the Tic-Tac-Toe API as an Effect v4 HttpApi group.
//
// Mirrors `@s2h/swish/examples/counter-api`: an abstract `TicTacToeEngine`
// service (the plug-in seam, keyed by `gameId`), the `TicTacToeApi` HttpApi
// (one POST per RPC under `/tic-tac-toe/:gameId/...`), and the `TicTacToeApiLive`
// handler layer that forwards to the service. Host-agnostic; served by the Worker.

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
import { PlaceInput, TicTacToeConfig, TicTacToePlayer, TicTacToeShared } from "./swish";

type TicTacToeConfigType = typeof TicTacToeConfig.Type;
type PlaceInputType = typeof PlaceInput.Type;
type TicTacToeSnapshot = GameSnapshot<typeof TicTacToeShared.Type, typeof TicTacToePlayer.Type>;

export class TicTacToeEngine extends Context.Service<TicTacToeEngine, {
	readonly initialize: (
		gameId: GameId,
		payload: { readonly code: GameCode; readonly config: TicTacToeConfigType }
	) => Effect.Effect<void>;
	readonly getState: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<TicTacToeSnapshot, GameNotFound | CorruptState>;
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
	readonly place: (
		gameId: GameId,
		playerInfo: PlayerInfo,
		input: PlaceInputType
	) => Effect.Effect<void, MoveError>;
	readonly undo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<TicTacToeSnapshot, NothingToUndo | GameNotFound | CorruptState>;
	readonly redo: (
		gameId: GameId,
		playerInfo: PlayerInfo
	) => Effect.Effect<TicTacToeSnapshot, NothingToRedo | GameNotFound | CorruptState>;
}>()( "tictactoe/TicTacToeEngine" ) {}

const params = { gameId: GameId };
const Snapshot = GameSnapshot( TicTacToeShared, TicTacToePlayer );

const TicTacToeGroup = HttpApiGroup.make( "tictactoe" ).add(
	HttpApiEndpoint.post( "initialize", "/tic-tac-toe/:gameId/initialize", {
		params,
		payload: Schema.Struct( { code: GameCode, config: TicTacToeConfig } )
	} ),
	HttpApiEndpoint.post( "getState", "/tic-tac-toe/:gameId/getState", {
		params,
		payload: PlayerInfo,
		success: Snapshot,
		error: Schema.Union( [ GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "join", "/tic-tac-toe/:gameId/join", {
		params,
		payload: PlayerInfo,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "addBots", "/tic-tac-toe/:gameId/addBots", {
		params,
		error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "start", "/tic-tac-toe/:gameId/start", {
		params,
		error: Schema.Union( [ CannotStart, AlreadyJoined, GameNotFound, CorruptState, PhaseNotFound ] )
	} ),
	HttpApiEndpoint.post( "place", "/tic-tac-toe/:gameId/place", {
		params,
		payload: Schema.Struct( { playerInfo: PlayerInfo, input: PlaceInput } ),
		error: MoveError
	} ),
	HttpApiEndpoint.post( "undo", "/tic-tac-toe/:gameId/undo", {
		params,
		payload: PlayerInfo,
		success: Snapshot,
		error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
	} ),
	HttpApiEndpoint.post( "redo", "/tic-tac-toe/:gameId/redo", {
		params,
		payload: PlayerInfo,
		success: Snapshot,
		error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
	} )
);

export class TicTacToeApi extends HttpApi.make( "tictactoe" ).add( TicTacToeGroup ) {}

export const TicTacToeApiLive = HttpApiBuilder.group( TicTacToeApi, "tictactoe", ( handlers ) =>
	handlers
		.handle( "initialize", ( { params, payload } ) =>
			Effect.flatMap( TicTacToeEngine, ( engine ) => engine.initialize( params.gameId, payload ) ) )
		.handle( "getState", ( { params, payload } ) =>
			Effect.flatMap( TicTacToeEngine, ( engine ) => engine.getState( params.gameId, payload ) ) )
		.handle( "join", ( { params, payload } ) =>
			Effect.flatMap( TicTacToeEngine, ( engine ) => engine.join( params.gameId, payload ) ) )
		.handle( "addBots", ( { params } ) =>
			Effect.flatMap( TicTacToeEngine, ( engine ) => engine.addBots( params.gameId ) ) )
		.handle( "start", ( { params } ) =>
			Effect.flatMap( TicTacToeEngine, ( engine ) => engine.start( params.gameId ) ) )
		.handle( "place", ( { params, payload } ) =>
			Effect.flatMap( TicTacToeEngine, ( engine ) =>
				engine.place( params.gameId, payload.playerInfo, payload.input ) ) )
		.handle( "undo", ( { params, payload } ) =>
			Effect.flatMap( TicTacToeEngine, ( engine ) => engine.undo( params.gameId, payload ) ) )
		.handle( "redo", ( { params, payload } ) =>
			Effect.flatMap( TicTacToeEngine, ( engine ) => engine.redo( params.gameId, payload ) ) ) );
