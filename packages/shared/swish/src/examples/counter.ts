// @s2h/swish/examples/counter — a type-check fixture, NOT a shipped game.
//
// A trivial single-player "count to a target" game. It exercises the framework
// end to end at compile time under event sourcing: `defineGame` inference, an
// event union + pure `apply` reducer, `execute` emitting domain events, the
// `EngineRpc` builders (incl. undo/redo), and wiring the `Engine` to the RPC
// group with `RpcGroup.toLayer`. If this file type-checks, the framework
// composes.

import { Effect, Match, Schema } from "effect";
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

// --- Domain events + reducer ------------------------------------------------

const Incremented = Schema.TaggedStruct( "counter/Incremented", {} );
const Added = Schema.TaggedStruct( "counter/Added", { amount: Schema.Number } );

const CounterEvent = Schema.Union( [ Incremented, Added ] );
type CounterEvent = typeof CounterEvent.Type;
type CounterState = typeof CounterState.Type;

/** Pure reducer: the ONLY place `state` changes. No Effect, no Random. */
const apply = ( state: CounterState, event: CounterEvent ): CounterState =>
	Match.value( event ).pipe(
		Match.tag( "counter/Incremented", () => ( { ...state, count: state.count + 1 } ) ),
		Match.tag( "counter/Added", ( e ) => ( { ...state, count: state.count + e.amount } ) ),
		Match.exhaustive
	);

const counter = makeEngine(
	defineGame( {
		name: "counter",
		stateSchema: CounterState,
		configSchema: CounterConfig,
		sharedViewSchema: CounterShared,
		playerViewSchema: CounterPlayer,
		eventSchema: CounterEvent,
		apply,

		setup: ( config ) => Effect.succeed( { count: 0, target: config.target } ),
		endIf: ( { state } ) => Effect.succeed( state.count >= state.target ),
		sharedView: ( { state } ) => Effect.succeed( state ),
		playerView: ( _data, playerId ) => Effect.succeed( { playerId } ),
		resolveNextPlayer: ( _data, playerId ) => Effect.succeed( playerId ),

		moves: {
			increment: {
				input: IncrementInput,
				validate: () => Effect.void,
				// Emit an event — do not mutate/return state.
				execute: () => Effect.succeed( [ Incremented.make( {} ) ] )
			},
			add: {
				input: AddInput,
				validate: ( _data, _playerId, input ) =>
					input.amount > 0
						? Effect.void
						: Effect.fail( new InvalidMove( { move: "add", reason: "amount must be positive" } ) ),
				execute: ( _data, _playerId, input ) => Effect.succeed( [ Added.make( { amount: input.amount } ) ] )
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
	EngineRpc.makeForMove( "add", AddInput ),
	EngineRpc.makeUndo( CounterState, CounterPlayer ),
	EngineRpc.makeRedo( CounterState, CounterPlayer )
) {
	// Lifecycle + undo/redo map 1:1 onto the engine; each move handler forwards
	// the decoded payload to the generic `submitMove` with its exact input type.
	public static layer = CounterRpcs.toLayer( {
		initialize: counter.initialize,
		getState: counter.getState,
		join: counter.join,
		addBots: counter.addBots,
		start: counter.start,
		undo: counter.undo,
		redo: counter.redo,
		increment: ( { playerInfo, input } ) => counter.submitMove( "increment", playerInfo, input ),
		add: ( { playerInfo, input } ) => counter.submitMove( "add", playerInfo, input )
	} );

	public static makeClient = RpcClient.make( CounterRpcs );
}
