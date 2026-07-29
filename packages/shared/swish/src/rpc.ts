// @s2h/swish/rpc — the engine's RPC surface builders.
//
// Pure / browser-safe (schema only). `EngineRpc` is a set of factories that
// produce the typed RPCs for a game — the shared lifecycle RPCs plus one
// first-class RPC per declared move (the "per-game move RPCs" model). A game
// composes them into an `RpcGroup` and binds it to its `Engine` via `toLayer`.

import * as Schema from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { GetStateError, JoinError, MoveError, RedoError, StartError, UndoError } from "./errors.ts";
import {
	Audience,
	GameLog,
	InitializeInput,
	InitializeResponse,
	JoinGameResponse,
	MovePayload,
	PlayerInfo
} from "./schema.ts";

export const MoveRpc = <const Move extends string, In extends Schema.Top>(
	move: Move,
	input: In
) =>
	Rpc.make( move, { success: Schema.Void, payload: MovePayload( input ), error: MoveError } );

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
		Rpc.make( "getState", { success: snapshot, payload: Audience, error: GetStateError } ),
		Rpc.make( "getLog", { success: GameLog, payload: Audience, error: GetStateError } ),
		Rpc.make( "join", { success: JoinGameResponse, payload: PlayerInfo, error: JoinError } ),
		Rpc.make( "addBots", { success: Schema.Void, error: JoinError } ),
		Rpc.make( "start", { success: Schema.Void, error: StartError } ),
		Rpc.make( "undo", { success: snapshot, payload: PlayerInfo, error: UndoError } ),
		Rpc.make( "redo", { success: snapshot, payload: PlayerInfo, error: RedoError } ),
		...moves
	);

