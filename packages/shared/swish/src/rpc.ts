// @s2h/swish/rpc — the engine's RPC surface builders.
//
// Pure / browser-safe (schema only). `EngineRpc` is a set of factories that
// produce the typed RPCs for a game — the shared lifecycle RPCs plus one
// first-class RPC per declared move (the "per-game move RPCs" model). A game
// composes them into an `RpcGroup` and binds it to its `Engine` via `toLayer`.

import * as Schema from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
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
} from "./errors";
import { InitializeInput, InitializeResponse, JoinGameResponse, PlayerInfo } from "./schema";

export class EngineRpc {
	public static makeInitialize = <Config extends Schema.Top>( config: Config ) =>
		Rpc.make( "initialize", {
			success: InitializeResponse,
			payload: InitializeInput( config )
		} );

	public static makeGetState = <Snapshot extends Schema.Top>( snapshot: Snapshot ) =>
		Rpc.make( "getState", {
			success: snapshot,
			payload: PlayerInfo,
			error: Schema.Union( [ GameNotFound, CorruptState ] )
		} );

	public static makeJoin = () =>
		Rpc.make( "join", {
			success: JoinGameResponse,
			payload: PlayerInfo,
			error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
		} );

	public static makeAddBots = () =>
		Rpc.make( "addBots", {
			success: Schema.Void,
			error: Schema.Union( [ GameFull, AlreadyJoined, GameNotFound, CorruptState ] )
		} );

	public static makeStart = () =>
		Rpc.make( "start", {
			success: Schema.Void,
			error: Schema.Union( [
				CannotStart,
				AlreadyJoined,
				GameNotFound,
				CorruptState,
				PhaseNotFound
			] )
		} );

	public static makeForMove = <Move extends string, In extends Schema.Top>(
		move: Move,
		input: In
	) =>
		Rpc.make( move, {
			success: Schema.Void,
			payload: { playerInfo: PlayerInfo, input },
			error: MoveError
		} );

	public static makeUndo = <Snapshot extends Schema.Top>( snapshot: Snapshot ) =>
		Rpc.make( "undo", {
			success: snapshot,
			payload: PlayerInfo,
			error: Schema.Union( [ NothingToUndo, GameNotFound, CorruptState ] )
		} );

	public static makeRedo = <Snapshot extends Schema.Top>( snapshot: Snapshot ) =>
		Rpc.make( "redo", {
			success: snapshot,
			payload: PlayerInfo,
			error: Schema.Union( [ NothingToRedo, GameNotFound, CorruptState ] )
		} );
}
