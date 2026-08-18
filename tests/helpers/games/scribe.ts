import * as Schema from "effect/Schema";

import { makeEngine } from "@/swish/server/engine.ts";
import { BaseGameConfig, InvalidMove, PlayerId, SeatStatusChanged } from "@/swish/shared/schema.ts";
import { playerIdFor } from "@/swish/server/utils.ts";

import type { GameStructure } from "@/swish/server/structure.ts";

/**
 * A four-seat game with one move for every way a move can differ, and every
 * lifecycle hook wired to write into the same log — so a test reads the order
 * the engine ran things in rather than inferring it from what changed.
 *
 * - `note` never ends the turn, so a seat may play it repeatedly.
 * - `wager` ends the turn only for some inputs, which is the callable form.
 * - `peek` may be played out of turn, which is `canMove`.
 * - `special` is switched off by config, which is `enabledWhen`.
 * - `fold` takes its own seat out of the rotation.
 * - `finish` is what ends a seat's game, and the table's once all of them have.
 *
 * It declares no `botMove`, deliberately: without one no seat is ever machine
 * played, autoplay is unavailable, and a clock that runs out skips the turn
 * rather than handing the seat over.
 */

export type ScribeState = typeof ScribeState.Type;
export const ScribeState = Schema.Struct( {
	log: Schema.Array( Schema.String ),
	notes: Schema.Record( PlayerId, Schema.Number ),
	finished: Schema.Array( PlayerId )
} );

export type ScribeConfig = typeof ScribeConfig.Type;
export const ScribeConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	allowSpecial: Schema.Boolean
} );

export type ScribeView = typeof ScribeView.Type;
export const ScribeView = Schema.Struct( {
	...ScribeState.fields,
	playerId: Schema.optional( PlayerId )
} );

export const Noted = Schema.TaggedStruct( "scribe/ev/Noted", { note: Schema.String } );

export const Wrote = Schema.TaggedStruct( "scribe/ev/Wrote", {
	playerId: PlayerId,
	text: Schema.String
} );

export const Finished = Schema.TaggedStruct( "scribe/ev/Finished", { playerId: PlayerId } );

export type ScribeEvent = typeof ScribeEvent.Type;
export const ScribeEvent = Schema.Union( [ Noted, Wrote, Finished ] );

export type NoteInput = typeof NoteInput.Type;
export const NoteInput = Schema.Struct( { text: Schema.String } );

export type WagerInput = typeof WagerInput.Type;
export const WagerInput = Schema.Struct( { amount: Schema.Number } );

export type EmptyInput = typeof EmptyInput.Type;
export const EmptyInput = Schema.Struct( {} );

type ScribeMoves = {
	note: typeof NoteInput;
	wager: typeof WagerInput;
	peek: typeof EmptyInput;
	special: typeof EmptyInput;
	fold: typeof EmptyInput;
	finish: typeof EmptyInput;
};

const logged = ( state: ScribeState, entry: string ): ScribeState =>
	( { ...state, log: [ ...state.log, entry ] } );

export const scribeStructure: GameStructure<
	"scribe",
	ScribeState,
	ScribeConfig,
	ScribeMoves,
	Record<string, never>,
	ScribeEvent,
	ScribeView
> = {
	name: "scribe",

	schemas: {
		state: ScribeState,
		config: ScribeConfig,
		events: ScribeEvent,
		view: ScribeView,
		moves: {
			note: NoteInput,
			wager: WagerInput,
			peek: EmptyInput,
			special: EmptyInput,
			fold: EmptyInput,
			finish: EmptyInput
		}
	},

	setup: ( _config, rng ) => ( {
		log: [ `setup:${ rng( "deal" ).int( 1000 ) }` ],
		notes: {},
		finished: []
	} ),

	apply: ( state, event ) => {
		switch ( event._tag ) {
			case "scribe/ev/Noted":
				return logged( state, event.note );

			case "scribe/ev/Wrote":
				return {
					...logged( state, `wrote:${ event.playerId }:${ event.text }` ),
					notes: { ...state.notes, [ event.playerId ]: ( state.notes[ event.playerId ] ?? 0 ) + 1 }
				};

			case "scribe/ev/Finished":
				return {
					...logged( state, `finished:${ event.playerId }` ),
					finished: [ ...state.finished, event.playerId ]
				};
		}
	},

	endIf: ( { state, context } ) => context.players.length > 0
		&& context.players.every( playerId => state.finished.includes( playerId ) ),

	view: ( { state }, audience ) => ( { ...state, playerId: playerIdFor( audience ) } ),

	resolveResults: ( { state, context } ) => ( {
		ranking: context.players.map( playerId => ( {
			playerId,
			rank: 1,
			score: state.notes[ playerId ] ?? 0
		} ) )
	} ),

	hooks: {
		onJoin: ( _data, playerId ) => [ Noted.make( { note: `join:${ playerId }` } ) ],

		// The value is drawn from the game's seed, so a rebuild reproduces it.
		onStart: ( _data, rng ) => [ Noted.make( { note: `start:${ rng( "deal" ).int( 1000 ) }` } ) ],

		beforeMove: (
			_data,
			_playerId,
			moveType
		) => [ Noted.make( { note: `before:${ moveType }` } ) ],

		afterMove: ( _data, _playerId, moveType ) => [ Noted.make( { note: `after:${ moveType }` } ) ],

		onEnd: () => [ Noted.make( { note: "end" } ) ]
	},

	moves: {

		// A seat may write as many notes as it likes without giving up the turn.
		note: {
			endsTurn: false,
			validate: ( _data, _playerId, input ) => input.text.length > 0
				? undefined
				: new InvalidMove( { move: "note", reason: "A note needs text." } ),

			execute: ( _data, playerId, input ) => [ Wrote.make( { playerId, text: input.text } ) ]
		},

		// Ends the turn only when something was actually staked, and rolls for the
		// outcome — the one move here whose result comes out of the commit's rng.
		wager: {
			endsTurn: ( _data, _playerId, input ) => input.amount > 0,
			validate: () => undefined,
			execute: ( _data, _playerId, input, rng ) => [
				Noted.make( { note: `wager:${ input.amount }:${ rng( "roll" ).int( 1_000_000 ) }` } )
			]
		},

		// Playable by anyone, at any time, and it costs nobody their turn.
		peek: {
			canMove: () => true,
			endsTurn: false,
			validate: () => undefined,
			execute: ( _data, playerId ) => [ Noted.make( { note: `peek:${ playerId }` } ) ]
		},

		// Switched off unless the table was created with it.
		special: {
			enabledWhen: config => config.allowSpecial,
			validate: () => undefined,
			execute: ( _data, playerId ) => [ Noted.make( { note: `special:${ playerId }` } ) ]
		},

		// Takes the seat out of the rotation, and out of play.
		fold: {
			validate: () => undefined,
			execute: ( _data, playerId ) => [
				Noted.make( { note: `fold:${ playerId }` } ),
				SeatStatusChanged.make( { playerId, status: "folded" } )
			]
		},

		finish: {
			validate: ( { state }, playerId ) => state.finished.includes( playerId )
				? new InvalidMove( { move: "finish", reason: "Already finished." } )
				: undefined,

			execute: ( _data, playerId ) => [ Finished.make( { playerId } ) ]
		}
	}
};

export const scribeEngine = makeEngine( scribeStructure );
