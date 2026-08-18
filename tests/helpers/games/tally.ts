import * as Schema from "effect/Schema";

import { makeEngine } from "@/swish/server/engine.ts";
import { BaseGameConfig, PlayerId } from "@/swish/shared/schema.ts";
import { playerIdFor } from "@/swish/server/utils.ts";

import type { GameStructure } from "@/swish/server/structure.ts";

/**
 * A deliberately plain four-seat game: everyone plays `score` once, highest total
 * wins. It exists so engine tests have a structure with enough seats to form
 * sides and a turn-ending move that actually rotates — the shipped games have
 * neither (tic-tac-toe seats two, wordle never ends a turn).
 */

export type TallyState = typeof TallyState.Type;
export const TallyState = Schema.Struct( {
	points: Schema.Record( PlayerId, Schema.Number )
} );

export type TallyConfig = typeof TallyConfig.Type;
export const TallyConfig = Schema.Struct( { ...BaseGameConfig.fields } );

export type TallyView = typeof TallyView.Type;
export const TallyView = Schema.Struct( {
	points: Schema.Record( PlayerId, Schema.Number ),
	playerId: Schema.optional( PlayerId )
} );

export const Scored = Schema.TaggedStruct( "tally/ev/Scored", {
	playerId: PlayerId,
	points: Schema.Number
} );

export type TallyEvent = typeof TallyEvent.Type;
export const TallyEvent = Schema.Union( [ Scored ] );

export type ScoreInput = typeof ScoreInput.Type;
export const ScoreInput = Schema.Struct( { points: Schema.Number } );

export const tallyStructure: GameStructure<
	"tally",
	TallyState,
	TallyConfig,
	{ score: typeof ScoreInput },
	Record<string, never>,
	TallyEvent,
	TallyView
> = {
	name: "tally",

	schemas: {
		state: TallyState,
		config: TallyConfig,
		events: TallyEvent,
		view: TallyView,
		moves: { score: ScoreInput }
	},

	setup: () => ( { points: {} } ),

	apply: ( state, event ) => ( {
		points: { ...state.points, [ event.playerId ]: event.points }
	} ),

	endIf: ( { state, context } ) =>
		context.players.every( playerId => state.points[ playerId ] !== undefined ),

	view: ( { state }, audience ) => ( {
		points: state.points,
		...( playerIdFor( audience ) ? { playerId: playerIdFor( audience ) } : {} )
	} ),

	resolveResults: ( { state, context } ) => {
		const scored = context.players
			.map( playerId => ( { playerId, score: state.points[ playerId ] ?? 0 } ) )
			.sort( ( a, b ) => b.score - a.score );

		return {
			ranking: scored.map( entry => ( {
				playerId: entry.playerId,
				score: entry.score,
				rank: scored.findIndex( other => other.score === entry.score ) + 1
			} ) )
		};
	},

	hooks: {},

	moves: {
		score: {
			validate: () => undefined,
			execute: ( _data, playerId, input ) => [ Scored.make( { playerId, points: input.points } ) ]
		}
	},

	botMove: () => ( { moveType: "score", input: { points: 0 } } )
};

export const tallyEngine = makeEngine( tallyStructure );

/**
 * The same game seated backwards: it declares a `resolveNextPlayer`, so the turn
 * follows that rather than the engine's default round-robin.
 */
const reversedStructure: GameStructure<
	"tally",
	TallyState,
	TallyConfig,
	{ score: typeof ScoreInput },
	Record<string, never>,
	TallyEvent,
	TallyView
> = {
	...tallyStructure,
	resolveNextPlayer: ( { context }, playerId ) => {
		const index = context.players.indexOf( playerId );
		return context.players[ ( index - 1 + context.players.length ) % context.players.length ];
	}
};

export const reversedTallyEngine = makeEngine( reversedStructure );
