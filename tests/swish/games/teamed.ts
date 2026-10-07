import * as Schema from "effect/Schema";

import { produce } from "immer";

import { BaseGameConfig, PlayerId, TeamId } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";


/**
 * A team game that ranks its players and leaves the sides to the engine.
 *
 * Fish is the only shipped team game and it fills `teamRanking` and
 * `winningTeam` itself, for a good reason of its own — so the engine's
 * compilation path has never run. `compileStandings` has two branches worth
 * exercising: sides placed on *total score* where a game scores its players, and
 * sides placed on each side's *best rank* where it does not. `scoring` picks
 * between them.
 */

export const TeamedConfig = Schema.Struct( {
	...BaseGameConfig.fields,

	/** Whether `resolveResults` puts a score on each standing. */
	scoring: Schema.Boolean
} );

export type TeamedState = typeof TeamedState.Type;
export const TeamedState = Schema.Struct( {
	points: Schema.Record( PlayerId, Schema.Int ),
	over: Schema.Boolean
} );

export const Gained = Schema.TaggedStruct( "teamed/ev/Gained", {
	playerId: PlayerId,
	points: Schema.Int
} );

export const Ended = Schema.TaggedStruct( "teamed/ev/Ended", {} );

export const TeamedEvent = Schema.Union( [ Gained, Ended ] );

export const TeamedView = Schema.Struct( {
	...TeamedState.fields,
	playerId: Schema.optional( PlayerId )
} );

const GainInput = Schema.Struct( { points: Schema.Int } );
const EndInput = Schema.Struct( {} );

export const TEAMED_TEAMS: ReadonlyArray<TeamId> = [
	TeamId.make( "SIDE_A" ),
	TeamId.make( "SIDE_B" )
];


export const {
	Engine: TeamedEngine,
	EngineLive: TeamedEngineLive,
	Structure: TeamedStructure
} = makeEngine( {
	name: "teamedtest",

	schemas: {
		state: TeamedState,
		config: TeamedConfig,
		events: TeamedEvent,
		view: TeamedView,
		moves: { gain: GainInput, end: EndInput }
	},

	defaultConfig: () => TeamedConfig.make( {
		playerCount: 4,
		autoStart: false,
		scoring: true,
		teams: TEAMED_TEAMS,
		botDelayMillis: 3_600_000,
		moveTimeoutMillis: 3_600_000
	} ),

	setup: () => TeamedState.make( { points: {}, over: false } ),

	apply: ( state, event ) => produce( state, draft => {
		switch ( event._tag ) {
			case "teamed/ev/Gained":
				draft.points[ event.playerId ] = ( draft.points[ event.playerId ] ?? 0 ) + event.points;
				return;

			case "teamed/ev/Ended":
				draft.over = true;
		}
	} ),

	endIf: ( { state } ) => state.over,

	/**
	 * Ranks the players and stops there. No `teamRanking`, no `winningTeam` — the
	 * engine compiles both from this, which is the whole point of the game.
	 */
	resolveResults: ( { state, config, context } ) => {
		const pointsOf = ( playerId: PlayerId ) => state.points[ playerId ] ?? 0;
		const ranked = [ ...context.players ].sort(
			( left, right ) => pointsOf( right ) - pointsOf( left )
		);

		return {
			_tag: "swish/Standings" as const,
			ranking: ranked.map( playerId => ( {
				_tag: "swish/PlayerStanding" as const,
				playerId,
				rank: 1 + ranked.filter( other => pointsOf( other ) > pointsOf( playerId ) ).length,
				...( config.scoring ? { score: pointsOf( playerId ) } : {} )
			} ) )
		};
	},

	view: ( { state }, audience ) => TeamedView.make( {
		...state,
		playerId: audience._tag === "swish/PlayerAudience" ? audience.playerId : undefined
	} ),

	hooks: {},

	moves: {
		gain: {
			validate: () => undefined,
			execute: ( _data, playerId, { points } ) => [ Gained.make( { playerId, points } ) ]
		},

		end: {
			validate: () => undefined,
			execute: () => [ Ended.make( {} ) ]
		}
	}
} );
