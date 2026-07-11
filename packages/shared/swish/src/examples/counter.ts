// @s2h/swish/examples/counter — a type-check fixture, NOT a shipped game.
//
// A trivial single-player "count to a target" game. Its only purpose is to
// exercise the framework's generics end to end at compile time: `defineGame`
// inference, the `EngineRpc` builders (one first-class RPC per move), the
// `Engine` produced by `makeEngine`, and wiring the two together with
// `RpcGroup.toLayer`. If this file type-checks, the framework composes.

import { Effect, Schema } from "effect";
import { RpcClient, RpcGroup } from "effect/unstable/rpc";
import { makeEngine } from "../engine";
import { InvalidMove } from "../errors";
import { EngineRpc } from "../rpc";
import { PlayerId } from "../schema";
import { defineGame } from "../structure";

const CounterConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.optional( Schema.Boolean ),
	target: Schema.Number
} );

const CounterState = Schema.Struct( {
	count: Schema.Number,
	target: Schema.Number
} );

const CounterShared = CounterState;
const CounterPlayer = Schema.Struct( { playerId: PlayerId } );

const IncrementInput = Schema.Struct( {} );
const AddInput = Schema.Struct( { amount: Schema.Number } );

const counter = makeEngine(
	defineGame( {
		name: "counter",
		stateSchema: CounterState,
		configSchema: CounterConfig,
		sharedViewSchema: CounterShared,
		playerViewSchema: CounterPlayer,

		setup: ( config ) => Effect.succeed( { count: 0, target: config.target } ),
		endIf: ( { state } ) => Effect.succeed( state.count >= state.target ),
		sharedView: ( { state } ) => Effect.succeed( state ),
		playerView: ( _data, playerId ) => Effect.succeed( { playerId } ),
		resolveNextPlayer: ( _data, playerId ) => Effect.succeed( playerId ),

		moves: {
			increment: {
				input: IncrementInput,
				validate: () => Effect.void,
				execute: ( { state } ) => Effect.succeed( { ...state, count: state.count + 1 } )
			},
			add: {
				input: AddInput,
				validate: ( _data, _playerId, input ) =>
					input.amount > 0
						? Effect.void
						: Effect.fail( new InvalidMove( { move: "add", reason: "amount must be positive" } ) ),
				execute: ( { state }, _playerId, input ) => Effect.succeed( {
					...state,
					count: state.count + input.amount
				} )
			}
		}
	} )
);

export class CounterRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( CounterConfig ),
	EngineRpc.makeGetState( CounterState, CounterPlayer ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "increment", IncrementInput ),
	EngineRpc.makeForMove( "add", AddInput )
) {
	// Lifecycle handlers map 1:1 onto the engine; each move handler forwards the
	// decoded payload to the generic `submitMove` with its exact input type.
	public static layer = CounterRpcs.toLayer( {
		initialize: counter.initialize,
		getState: counter.getState,
		join: counter.join,
		addBots: counter.addBots,
		start: counter.start,
		increment: ( { playerInfo, input } ) => counter.submitMove( "increment", playerInfo, input ),
		add: ( { playerInfo, input } ) => counter.submitMove( "add", playerInfo, input )
	} );

	public static makeClient = RpcClient.make( CounterRpcs );
}
