// @s2h/swish/rpc — the engine's RPC surface builders.
//
// Pure / browser-safe (schema only). `EngineRpc` is a set of factories that
// produce the typed RPCs for a game — the shared lifecycle RPCs plus one
// first-class RPC per declared move (the "per-game move RPCs" model). A game
// composes them into an `RpcGroup` and binds it to its `Engine` via `toLayer`.

import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";
import {
	AlreadyJoined,
	CannotStart,
	CorruptState,
	GameFull,
	GameNotFound,
	MoveError,
	PhaseNotFound
} from "./errors";
import { GameCode, GameId, GameSnapshot, PlayerInfo } from "./schema";

export class EngineRpc {
	public static makeInitialize = <Config extends Schema.Top>( config: Config ) =>
		Rpc.make( "initialize", {
			success: Schema.Void,
			payload: { id: GameId, code: GameCode, config }
		} );

	public static makeGetState = <SV extends Schema.Top, PV extends Schema.Top>(
		shared: SV,
		player: PV
	) =>
		Rpc.make( "getState", {
			success: GameSnapshot( shared, player ),
			payload: PlayerInfo,
			error: Schema.Union( [ GameNotFound, CorruptState ] )
		} );

	public static makeJoin = () =>
		Rpc.make( "join", {
			success: Schema.Void,
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
}
