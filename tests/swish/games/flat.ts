import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { produce } from "immer";

import { InvalidMove } from "@/swish/errors";
import { BaseGameConfig, PlayerId } from "@/swish/schema";
import { makeEngine } from "@/swish/server/engine";


/**
 * A flat game that exists to exercise the parts of `GameStructure` no shipped
 * game reaches.
 *
 * Every rule here is deliberately trivial — a counter and a log of who moved —
 * because none of what it is testing is about the game. What it is testing is
 * everything around the move: the default round-robin, the engine's own
 * standings when a game declines to rank its players, a move gated off the
 * config, a move that keeps the turn, and a `beforeMove` hook whose events have
 * to disappear when the move it ran ahead of turns out to be illegal.
 */

export const FlatConfig = Schema.Struct( {
	...BaseGameConfig.fields,

	/** Turns `bonus` on and off, so `enabledWhen` has something to read. */
	allowBonus: Schema.Boolean,

	/** What `endIf` counts up to. */
	target: Schema.Int,

	/**
	 * Makes `botMove` decline.
	 *
	 * A policy is allowed to have nothing to say — `undefined` parks the turn
	 * clock, and answers a hint with no suggestion rather than a refusal — and
	 * no shipped game's policy ever does it.
	 */
	silentBot: Schema.Boolean.pipe( Schema.withDecodingDefaultKey( Effect.succeed( false ) ) )
} );

export type FlatState = typeof FlatState.Type;
export const FlatState = Schema.Struct( {
	/** What each seat has scored. */
	scores: Schema.Record( PlayerId, Schema.Int ),

	/** Every event this game has folded, in order — the trail a test reads. */
	log: Schema.Array( Schema.String ),

	/** How many times `beforeMove` has run ahead of a move. */
	prepared: Schema.Int
} );

export const Scored = Schema.TaggedStruct( "flat/ev/Scored", {
	playerId: PlayerId,
	points: Schema.Int
} );

export const Prepared = Schema.TaggedStruct( "flat/ev/Prepared", { note: Schema.String } );

export const Noted = Schema.TaggedStruct( "flat/ev/Noted", { note: Schema.String } );

export const FlatEvent = Schema.Union( [ Scored, Prepared, Noted ] );

export const FlatView = Schema.Struct( {
	...FlatState.fields,
	playerId: Schema.optional( PlayerId )
} );

const ScoreInput = Schema.Struct( { points: Schema.Int } );
const BonusInput = Schema.Struct( {} );
const StayInput = Schema.Struct( { again: Schema.Boolean } );


export const {
	Engine: FlatEngine,
	EngineLive: FlatEngineLive,
	Structure: FlatStructure
} = makeEngine( {
	name: "flattest",

	schemas: {
		state: FlatState,
		config: FlatConfig,
		events: FlatEvent,
		view: FlatView,
		moves: { score: ScoreInput, bonus: BonusInput, stay: StayInput }
	},

	defaultConfig: () => FlatConfig.make( {
		playerCount: 2,
		autoStart: true,
		allowBonus: true,
		target: 10,
		silentBot: false,
		botDelayMillis: 3_600_000,
		moveTimeoutMillis: 3_600_000
	} ),

	setup: () => FlatState.make( { scores: {}, log: [], prepared: 0 } ),

	apply: ( state, event ) => produce( state, draft => {
		switch ( event._tag ) {
			case "flat/ev/Scored":
				draft.scores[ event.playerId ] = ( draft.scores[ event.playerId ] ?? 0 ) + event.points;
				draft.log.push( `scored:${ event.playerId }:${ event.points }` );
				return;

			case "flat/ev/Prepared":
				draft.prepared++;
				draft.log.push( `prepared:${ event.note }` );
				return;

			case "flat/ev/Noted":
				draft.log.push( `noted:${ event.note }` );
		}
	} ),

	endIf: ( { state, config, context } ) => context.players.length > 0
		&& context.players.some( playerId => ( state.scores[ playerId ] ?? 0 ) >= config.target ),

	/**
	 * Deliberately absent. Every shipped game ranks its own players, so the
	 * engine's behaviour with no `resolveResults` at all — no `ResultsResolved`
	 * event, and a completed game carrying no standings — has never been run.
	 */

	view: ( { state }, audience ) => FlatView.make( {
		...state,
		playerId: audience._tag === "swish/PlayerAudience" ? audience.playerId : undefined
	} ),

	hooks: {
		/**
		 * Runs after the turn guards but before the move's own `validate`, which is
		 * what makes it the one hook whose events can be thrown away: a commit that
		 * fails validation is discarded whole, this hook's events included.
		 */
		beforeMove: ( _data, playerId, moveType ) => [
			Prepared.make( { note: `${ String( moveType ) }:${ playerId }` } )
		]
	},

	moves: {
		score: {
			validate: ( _data, _playerId, { points } ) => points <= 0
				? new InvalidMove( { move: "score", reason: "Score at least one point." } )
				: undefined,

			execute: ( _data, playerId, { points } ) => [ Scored.make( { playerId, points } ) ]
		},

		/**
		 * Gated off the config rather than off the position, so the engine refuses
		 * it centrally — before `validate` is ever asked.
		 */
		bonus: {
			enabledWhen: ( config ) => config.allowBonus,
			validate: () => undefined,
			execute: ( _data, playerId ) => [ Scored.make( { playerId, points: 1 } ) ]
		},

		/**
		 * A move that can decline to end the turn, which no shipped game does.
		 * `endsTurn` is a function so a test can take both branches from one move.
		 */
		stay: {
			endsTurn: ( _data, _playerId, { again } ) => !again,
			validate: () => undefined,
			execute: ( _data, playerId ) => [ Noted.make( { note: `stayed:${ playerId }` } ) ]
		}
	},

	/** Scores a point. Enough for `autoPlay` to have somewhere to send a seat. */
	botMove: ( { config } ) => config.silentBot
		? undefined
		: ( { moveType: "score" as const, input: { points: 1 } } )
} );
