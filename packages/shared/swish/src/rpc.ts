// @s2h/swish/rpc — the engine's RPC surface builders.
//
// Pure / browser-safe (schema only). `EngineRpc` is a set of factories that
// produce the typed RPCs for a game — the shared lifecycle RPCs plus one
// first-class RPC per declared move (the "per-game move RPCs" model). A game
// composes them into an `RpcGroup` and binds it to its `Engine` via `toLayer`.

import * as Schema from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { GetStateError, JoinError, MoveError, RedoError, StartError, UndoError } from "./errors";
import { InitializeInput, InitializeResponse, JoinGameResponse, PlayerInfo } from "./schema";

export class EngineRpc {
	public static makeInitialize = <Config extends Schema.Top>( config: Config ) =>
		Rpc.make( "initialize", { success: InitializeResponse, payload: InitializeInput( config ) } );

	public static makeGetState = <Snapshot extends Schema.Top>( snapshot: Snapshot ) =>
		Rpc.make( "getState", { success: snapshot, payload: PlayerInfo, error: GetStateError } );

	public static makeJoin = () =>
		Rpc.make( "join", { success: JoinGameResponse, payload: PlayerInfo, error: JoinError } );

	public static makeAddBots = () =>
		Rpc.make( "addBots", { success: Schema.Void, error: JoinError } );

	public static makeStart = () =>
		Rpc.make( "start", { success: Schema.Void, error: StartError } );

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
		Rpc.make( "undo", { success: snapshot, payload: PlayerInfo, error: UndoError } );

	public static makeRedo = <Snapshot extends Schema.Top>( snapshot: Snapshot ) =>
		Rpc.make( "redo", { success: snapshot, payload: PlayerInfo, error: RedoError } );
}

export const MoveRpc = <const Move extends string, In extends Schema.Top>(
	move: Move,
	input: In
) =>
	Rpc.make( move, {
		success: Schema.Void,
		payload: { playerInfo: PlayerInfo, input },
		error: MoveError
	} );

export const EngineRpcs = <
	Config extends Schema.Top,
	Snapshot extends Schema.Top,
	const Moves extends ReadonlyArray<Rpc.Any>
>(
	config: Config,
	snapshot: Snapshot,
	moves: Moves
) =>
	RpcGroup.make(
		Rpc.make( "initialize", { success: InitializeResponse, payload: InitializeInput( config ) } ),
		Rpc.make( "getState", { success: snapshot, payload: PlayerInfo, error: GetStateError } ),
		Rpc.make( "join", { success: JoinGameResponse, payload: PlayerInfo, error: JoinError } ),
		Rpc.make( "addBots", { success: Schema.Void, error: JoinError } ),
		Rpc.make( "start", { success: Schema.Void, error: StartError } ),
		Rpc.make( "undo", { success: snapshot, payload: PlayerInfo, error: UndoError } ),
		Rpc.make( "redo", { success: snapshot, payload: PlayerInfo, error: RedoError } ),
		...moves
	);

