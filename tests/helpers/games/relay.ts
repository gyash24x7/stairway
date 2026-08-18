import * as Schema from "effect/Schema";

import { makeEngine } from "@/swish/server/engine.ts";
import { BaseGameConfig, InvalidMove, PlayerId } from "@/swish/shared/schema.ts";
import { playerIdFor } from "@/swish/server/utils.ts";

import type { GameStructure } from "@/swish/server/structure.ts";

/**
 * A phased four-seat game, written to exercise the parts of the engine a flat
 * game never reaches: entering and leaving phases, the moves each one allows,
 * and the two ways a phase resolves who acts next.
 *
 * A round is `passing` — every seat passes once, the turn rotating — followed by
 * `collecting`, which deliberately declares no `resolveNextPlayer`, so the seat
 * that entered it collects for the whole phase. That is the documented behaviour
 * of a phase that omits one, and the only place it can be observed.
 *
 * Everything a phase does is written into `trace`, so a test reads the hook
 * order off the state rather than inferring it from what changed.
 */

export type RelayState = typeof RelayState.Type;
export const RelayState = Schema.Struct( {
	round: Schema.Number,
	passes: Schema.Array( PlayerId ),
	collects: Schema.Array( PlayerId ),
	collected: Schema.Record( PlayerId, Schema.Number ),
	trace: Schema.Array( Schema.String )
} );

export type RelayConfig = typeof RelayConfig.Type;
export const RelayConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	rounds: Schema.Number
} );

export type RelayView = typeof RelayView.Type;
export const RelayView = Schema.Struct( {
	...RelayState.fields,
	playerId: Schema.optional( PlayerId )
} );

export const Passed = Schema.TaggedStruct( "relay/ev/Passed", { playerId: PlayerId } );

export const Collected = Schema.TaggedStruct( "relay/ev/Collected", {
	playerId: PlayerId,
	amount: Schema.Number
} );

export const Traced = Schema.TaggedStruct( "relay/ev/Traced", { note: Schema.String } );

export const RoundEnded = Schema.TaggedStruct( "relay/ev/RoundEnded", {} );

export type RelayEvent = typeof RelayEvent.Type;
export const RelayEvent = Schema.Union( [ Passed, Collected, Traced, RoundEnded ] );

export type PassInput = typeof PassInput.Type;
export const PassInput = Schema.Struct( {} );

export type CollectInput = typeof CollectInput.Type;
export const CollectInput = Schema.Struct( { amount: Schema.Number } );

type RelayMoves = { pass: typeof PassInput; collect: typeof CollectInput };
type RelayPhases = { passing: readonly [ "pass" ]; collecting: readonly [ "collect" ] };

const apply = ( state: RelayState, event: RelayEvent ): RelayState => {
	switch ( event._tag ) {
		case "relay/ev/Passed":
			return { ...state, passes: [ ...state.passes, event.playerId ] };

		case "relay/ev/Collected":
			return {
				...state,
				collects: [ ...state.collects, event.playerId ],
				collected: {
					...state.collected,
					[ event.playerId ]: ( state.collected[ event.playerId ] ?? 0 ) + event.amount
				}
			};

		case "relay/ev/Traced":
			return { ...state, trace: [ ...state.trace, event.note ] };

		case "relay/ev/RoundEnded":
			return { ...state, round: state.round + 1, passes: [], collects: [] };
	}
};

export const relayStructure: GameStructure<
	"relay",
	RelayState,
	RelayConfig,
	RelayMoves,
	RelayPhases,
	RelayEvent,
	RelayView
> = {
	name: "relay",

	schemas: {
		state: RelayState,
		config: RelayConfig,
		events: RelayEvent,
		view: RelayView,
		moves: { pass: PassInput, collect: CollectInput }
	},

	setup: () => ( { round: 0, passes: [], collects: [], collected: {}, trace: [] } ),

	apply,

	endIf: ( { state, config } ) => state.round >= config.rounds,

	view: ( { state }, audience ) => ( { ...state, playerId: playerIdFor( audience ) } ),

	resolveResults: ( { state, context } ) => {
		const scored = context.players
			.map( playerId => ( { playerId, score: state.collected[ playerId ] ?? 0 } ) )
			.sort( ( a, b ) => b.score - a.score );

		return {
			ranking: scored.map( entry => ( {
				playerId: entry.playerId,
				score: entry.score,
				rank: scored.findIndex( other => other.score === entry.score ) + 1
			} ) )
		};
	},

	hooks: {
		onStart: () => [ Traced.make( { note: "start" } ) ],
		onEnd: () => [ Traced.make( { note: "end" } ) ]
	},

	moves: {
		pass: {
			validate: () => undefined,
			execute: ( _data, playerId ) => [ Passed.make( { playerId } ) ]
		},

		collect: {
			validate: ( _data, _playerId, input ) => input.amount > 0
				? undefined
				: new InvalidMove( { move: "collect", reason: "Collect at least one." } ),

			execute: ( _data, playerId, input ) => [
				Collected.make( { playerId, amount: input.amount } )
			]
		}
	},

	initialPhase: "passing",

	phases: {
		passing: {
			moves: [ "pass" ],
			endIf: ( { state, context } ) => state.passes.length >= context.players.length,
			onEnter: () => [ Traced.make( { note: "enter:passing" } ) ],
			onExit: () => [ Traced.make( { note: "exit:passing" } ) ],
			resolveStartingPlayer: ( { context } ) => context.players[ 0 ],
			resolveNextPhase: () => "collecting",
			resolveNextPlayer: ( { context }, playerId ) => {
				const index = context.players.indexOf( playerId );
				return context.players[ ( index + 1 ) % context.players.length ];
			}
		},

		// No `resolveNextPlayer` on purpose: the seat that entered the phase holds
		// the turn for the whole of it.
		collecting: {
			moves: [ "collect" ],
			endIf: ( { state, context } ) => state.collects.length >= context.players.length,
			onEnter: () => [ Traced.make( { note: "enter:collecting" } ) ],
			onExit: () => [ Traced.make( { note: "exit:collecting" } ), RoundEnded.make( {} ) ],
			resolveNextPhase: () => "passing"
		}
	}
};

export const relayEngine = makeEngine( relayStructure );

type RelayStructure = GameStructure<
	"relay",
	RelayState,
	RelayConfig,
	RelayMoves,
	RelayPhases,
	RelayEvent,
	RelayView
>;

/**
 * Builds a variant of the game. The type arguments are spelled out because a
 * structure handed over as a whole gives inference nothing to read the phase
 * names off — only a literal does.
 *
 * @param structure - The variant to build.
 * @returns Its command surface.
 */
const relayEngineOf = ( structure: RelayStructure ) => makeEngine<
	"relay",
	RelayState,
	RelayConfig,
	RelayMoves,
	RelayPhases,
	RelayEvent,
	RelayView
>( structure );

/**
 * The same game pointed at a phase that does not exist, so `start` has nowhere
 * to go. The only way to reach `PhaseNotFound` on entry.
 */
const ghostStartStructure: RelayStructure = {
	...relayStructure,
	initialPhase: "ghost" as keyof RelayPhases
};

export const ghostStartEngine = relayEngineOf( ghostStartStructure );

/**
 * The same game whose first phase resolves into one that does not exist, so the
 * failure lands in a move's tail rather than at `start`.
 */
const ghostNextPhaseStructure: RelayStructure = {
	...relayStructure,
	phases: {
		...relayStructure.phases!,
		passing: {
			...relayStructure.phases!.passing,
			endIf: () => true,
			resolveNextPhase: () => "ghost" as keyof RelayPhases
		}
	}
};

export const ghostNextPhaseEngine = relayEngineOf( ghostNextPhaseStructure );
