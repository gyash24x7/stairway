import * as Schema from "effect/Schema";

import { produce } from "immer";

import { BaseGameConfig, PlayerId } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";
import { nextInOrder } from "@/swish/utils";


/**
 * A three-phase game, written to reach the phase machinery the two shipped
 * phased games leave alone.
 *
 * Callbreak and kingdomino both have exactly two phases, both answer
 * `resolveNextPhase` with a constant, and both supply `resolveStartingPlayer`
 * and a per-phase `resolveNextPlayer`. So four things have never run: a phase
 * that loops back to itself, a *conditional* next phase, a phase that lets the
 * cursor carry over rather than seating anybody, and a phase that leaves the
 * cursor exactly where the last move left it.
 *
 * The loop: `opening` runs once and hands over to `middle`. `middle` loops back
 * to itself until enough rounds have been played, then goes to `closing`.
 * `closing` ends the game.
 */

export const PhasedConfig = Schema.Struct( {
	...BaseGameConfig.fields,

	/** How many times `middle` loops before it gives way to `closing`. */
	rounds: Schema.Int
} );

export type PhasedState = typeof PhasedState.Type;
export const PhasedState = Schema.Struct( {
	/** One entry per move, tagged with the phase it was played in. */
	steps: Schema.Array( Schema.String ),

	/** How many times `middle` has been entered. */
	rounds: Schema.Int,

	/** Steps played since `middle` was last entered, reset on every entry. */
	roundSteps: Schema.Int,

	/** Whether `closing` has been reached. */
	done: Schema.Boolean
} );

export const Stepped = Schema.TaggedStruct( "phased/ev/Stepped", {
	playerId: PlayerId,
	phase: Schema.String
} );

export const RoundOpened = Schema.TaggedStruct( "phased/ev/RoundOpened", {} );

export const Finished = Schema.TaggedStruct( "phased/ev/Finished", {} );

export const PhasedEvent = Schema.Union( [ Stepped, RoundOpened, Finished ] );

export const PhasedView = Schema.Struct( {
	...PhasedState.fields,
	playerId: Schema.optional( PlayerId )
} );

const StepInput = Schema.Struct( {} );


export const {
	Engine: PhasedEngine,
	EngineLive: PhasedEngineLive,
	Structure: PhasedStructure
} = makeEngine( {
	name: "phasedtest",

	schemas: {
		state: PhasedState,
		config: PhasedConfig,
		events: PhasedEvent,
		view: PhasedView,
		moves: { step: StepInput, finish: StepInput }
	},

	defaultConfig: () => PhasedConfig.make( {
		playerCount: 2,
		autoStart: true,
		rounds: 2,
		botDelayMillis: 3_600_000,
		moveTimeoutMillis: 3_600_000
	} ),

	setup: () => PhasedState.make( { steps: [], rounds: 0, roundSteps: 0, done: false } ),

	apply: ( state, event ) => produce( state, draft => {
		switch ( event._tag ) {
			case "phased/ev/Stepped":
				draft.steps.push( `${ event.phase }:${ event.playerId }` );
				draft.roundSteps++;
				return;

			case "phased/ev/RoundOpened":
				draft.rounds++;
				draft.roundSteps = 0;
				return;

			case "phased/ev/Finished":
				draft.done = true;
		}
	} ),

	endIf: ( { state } ) => state.done,

	resolveResults: ( { context } ) => ( {
		_tag: "swish/Standings" as const,
		ranking: context.players.map( ( playerId, index ) => ( {
			_tag: "swish/PlayerStanding" as const,
			playerId,
			rank: index + 1
		} ) )
	} ),

	view: ( { state }, audience ) => PhasedView.make( {
		...state,
		playerId: audience._tag === "swish/PlayerAudience" ? audience.playerId : undefined
	} ),

	hooks: {},

	moves: {
		step: {
			validate: () => undefined,
			execute: ( { context }, playerId ) => [
				Stepped.make( { playerId, phase: String( context.phase ) } )
			]
		},

		finish: {
			validate: () => undefined,
			execute: ( { context }, playerId ) => [
				Stepped.make( { playerId, phase: String( context.phase ) } ),
				Finished.make( {} )
			]
		}
	},

	initialPhase: "opening",

	phases: {
		/**
		 * Runs for exactly one move. Neither `onEnter` nor `onExit`, and no
		 * `resolveStartingPlayer` — the cursor carries over from `start`, which is
		 * the case the doc comment describes and nothing has ever taken.
		 */
		opening: {
			moves: [ "step" ],
			endIf: ( { state } ) => state.steps.length >= 1,
			resolveNextPlayer: ( { context }, playerId ) => nextInOrder( context, playerId ),
			resolveNextPhase: () => "middle"
		},

		/**
		 * Loops back to itself until the table has played the rounds it was created
		 * for, then gives way. The only conditional `resolveNextPhase` anywhere.
		 */
		middle: {
			moves: [ "step" ],
			onEnter: () => [ RoundOpened.make( {} ) ],
			endIf: ( { state, context } ) => state.roundSteps >= context.players.length,
			resolveNextPlayer: ( { context }, playerId ) => nextInOrder( context, playerId ),
			resolveNextPhase: ( { state, config } ) => state.rounds >= config.rounds
				? "closing"
				: "middle"
		},

		/**
		 * Supplies no `resolveNextPlayer` at all, so the cursor is left exactly
		 * where the last move put it — the absent case the doc comment describes.
		 */
		closing: {
			moves: [ "finish" ],
			resolveStartingPlayer: ( { context } ) => context.players[ 0 ]!,
			endIf: ( { state } ) => state.done,
			resolveNextPhase: () => "closing"
		}
	}
} );
