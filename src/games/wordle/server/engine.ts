import * as Match from "effect/Match";
import { produce } from "immer";

import { decideWordleMove } from "@/games/wordle/server/bot/policy.ts";
import {
	boardFor,
	hasFinished,
	isValidWord,
	maxGuessesFor,
	nextUnfinishedSeat,
	normalizeGuess,
	scoreFor,
	solvedCountFor
} from "@/games/wordle/server/utils.ts";
import { dictionaries } from "@/games/wordle/shared/dictionary.ts";
import {
	DecidedEvent,
	ForfeitedEvent,
	ForfeitInput,
	GuessedEvent,
	GuessInput,
	WordleConfig,
	WordleEvents,
	WordleState,
	WordleView
} from "@/games/wordle/shared/schema.ts";
import { makeEngine } from "@/swish/server/engine.ts";
import { playerIdFor } from "@/swish/server/utils.ts";
import { InvalidMove } from "@/swish/shared/schema.ts";


// --- Engine ----------------------------------------------------------------

export const wordle = makeEngine( {
	name: "wordle",
	schemas: {
		state: WordleState,
		config: WordleConfig,
		events: WordleEvents,
		view: WordleView,
		moves: {
			guess: GuessInput,
			forfeit: ForfeitInput
		}
	},

	setup: ( config, rng ) => {
		const dictionary = dictionaries[ config.wordLength ];
		const random = rng( "words" );
		const selected = new Set<string>();
		while ( selected.size < config.wordCount ) {
			selected.add( dictionary[ random.int( dictionary.length ) ]! );
		}

		return { words: [ ...selected ], guesses: {}, forfeited: [], decided: false };
	},

	apply: ( state, event ) => produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "wordle/ev/Guessed", e => {
				( draft.guesses[ e.playerId ] ??= [] ).push( e.guess );
			} ),
			Match.tag( "wordle/ev/Forfeited", e => { draft.forfeited.push( e.playerId ); } ),
			Match.tag( "wordle/ev/Decided", () => { draft.decided = true; } ),
			Match.exhaustive
		);
	} ),

	endIf: ( { state, config, context } ) =>
		context.players.every( ( playerId ) => hasFinished( state, config, playerId ) ),

	resolveResults: ( { state, config, context } ) => {
		const scored = context.players
			.map( ( playerId ) => ( {
				playerId,
				score: scoreFor( state, config, playerId ),
				solved: solvedCountFor( state, playerId )
			} ) )
			.sort( ( a, b ) => b.score - a.score );

		const ranking = scored.map( ( entry ) => ( {
			playerId: entry.playerId,
			score: entry.score,
			rank: scored.findIndex( ( other ) => other.score === entry.score ) + 1
		} ) );

		const [ top, runnerUp ] = scored;

		// A solo table has nobody to outscore, so the only thing that can make its
		// one seat a winner is finishing the puzzle. Leaving a word unsolved and
		// still being told "You won!" is the case this rules out — a race is won by
		// outscoring the field, but a solitaire is won by solving it.
		const solo = context.players.length === 1;
		const won = !!top
			&& top.solved > 0
			&& ( solo
				? top.solved === state.words.length
				: top.score !== runnerUp?.score );

		return { ranking, winner: won ? top.playerId : undefined };
	},

	view: ( data, audience ) => WordleView.make( {
		maxGuesses: maxGuessesFor( data.config ),
		decided: data.state.decided,
		answers: data.state.decided ? data.state.words : undefined,
		playerId: playerIdFor( audience ),
		boards: data.context.players.map( playerId => boardFor( data, playerId, audience ) )
	} ),

	hooks: {
		onEnd: () => [ DecidedEvent.make( {} ) ]
	},

	// The cursor is a schedule, not a permission: `canMove` is `true` for every
	// seat whoever holds it, so a player never waits their turn, and moving it on
	// after each guess is only what tells the engine which seat to run the clocks
	// for and hand to `botMove` next. See `nextUnfinishedSeat`.
	resolveNextPlayer: nextUnfinishedSeat,

	moves: {
		guess: {
			canMove: () => true,
			endsTurn: true,
			validate: ( { state, config }, playerId, input ) => {
				if ( hasFinished( state, config, playerId ) ) {
					return new InvalidMove( {
						move: "guess",
						reason: "You have finished your board"
					} );
				}

				const guess = normalizeGuess( input.guess );

				if ( guess.length !== config.wordLength ) {
					return new InvalidMove( {
						move: "guess",
						reason: `A guess must be ${ config.wordLength } letters long`
					} );
				}

				if ( !isValidWord( guess, config.wordLength ) ) {
					return new InvalidMove( {
						move: "guess",
						reason: "The guess is not a valid word"
					} );
				}

				return;
			},

			execute: ( _data, playerId, input ) => [
				GuessedEvent.make( { playerId, guess: normalizeGuess( input.guess ) } )
			]
		},

		forfeit: {
			canMove: () => true,
			endsTurn: true,

			validate: ( { state, config }, playerId ) => {
				if ( hasFinished( state, config, playerId ) ) {
					return new InvalidMove( {
						move: "forfeit",
						reason: "You have finished your board"
					} );
				}

				return;
			},

			execute: ( _data, playerId ) => [ ForfeitedEvent.make( { playerId } ) ]
		}
	},

	botMove: decideWordleMove
} );
