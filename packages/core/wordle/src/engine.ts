// @s2h/wordle/engine — Wordle as an event-sourced swish game.
//
// The swish port of the old `AbstractGameEngine` DO, on the new `GameStructure`:
// `setup`/`apply`/`endIf`/views/hooks/`execute`/`validate` are plain synchronous
// functions — `validate` returns an `InvalidMove` to reject, or nothing to pass.
// The `guess` move EMITS a domain event carrying the computed per-word results,
// and the pure `apply` reducer in ./utils folds it onto `state` (the only place
// state changes). Random target selection happens once in `setup` and becomes the
// genesis state, so replay is deterministic. The pure helpers in ./utils are the
// single source of truth for the reducer and guess-result algorithm.

import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpcs, MoveRpc } from "@s2h/swish/rpc";
import { BasePlayerView } from "@s2h/swish/schema";
import { dictionaries } from "./dictionary";
import {
	GuessedEvent,
	GuessInput,
	GuessRow,
	VictoryDecidedEvent,
	WordleConfig,
	WordleEvents,
	WordleSharedView,
	WordleSnapshot,
	WordleState
} from "./schema";
import { allWordsGuessed, apply, computeRow } from "./utils";

// --- Engine ----------------------------------------------------------------

const wordle = makeEngine( {
	name: "wordle",
	schemas: {
		state: WordleState,
		config: WordleConfig,
		events: WordleEvents,
		moves: {
			guess: GuessInput
		},
		views: {
			shared: WordleSharedView,
			player: BasePlayerView
		}
	},

	setup: ( config ) => {
		const wordLength = config.wordLength;
		const dictionary = dictionaries[ wordLength ];
		const maxGuesses = config.wordCount + config.wordLength;

		const selected = new Set<string>();
		while ( selected.size < config.wordCount ) {
			selected.add( dictionary[ Math.floor( Math.random() * dictionary.length ) ]! );
		}

		const words = [ ...selected ];
		const guessResults = words.reduce(
			( acc, word ) => {
				acc[ word ] = [];
				return acc;
			},
			{} as Record<string, ReadonlyArray<typeof GuessRow.Type>>
		);

		return { words, guesses: [], guessResults, maxGuesses };
	},

	apply,

	endIf: ( { state } ) => allWordsGuessed( state ) || state.guesses.length === state.maxGuesses,

	sharedView: ( { state, config } ) => {
		const emptyRow: typeof GuessRow.Type = Array.from(
			{ length: config.wordLength },
			() => ( { letter: "", status: "absent" as const } )
		);

		return {
			guesses: state.guesses,
			maxGuesses: state.maxGuesses,
			victory: state.victory,
			guessResults: state.words.map( ( word ) => {
				const results = state.guessResults[ word ] ?? [];
				const solvedAt = results.findIndex(
					( row ) => row.every( ( r ) => r.status === "correct" )
				);
				const truncated = solvedAt !== -1 ? results.slice( 0, solvedAt + 1 ) : results;
				return [
					...truncated,
					...Array.from( { length: state.maxGuesses - truncated.length }, () => emptyRow )
				];
			} )
		};
	},

	playerView: ( _data, playerId ) => BasePlayerView.make( { playerId } ),

	hooks: {
		onEnd: ( { state } ) => [ VictoryDecidedEvent.make( { victory: allWordsGuessed( state ) } ) ]
	},

	moves: {
		guess: {
			validate: ( { state, config }, _playerId, { guess } ) => {
				if ( state.guesses.length >= state.maxGuesses ) {
					return new InvalidMove( { move: "guess", reason: "No more guesses left" } );
				}

				const dictionary = dictionaries[ config.wordLength ];
				if ( !dictionary.includes( guess ) ) {
					return new InvalidMove( { move: "guess", reason: "The guess is not a valid word" } );
				}

				return;
			},

			execute: ( { state }, _playerId, { guess } ) => [
				GuessedEvent.make( {
					guess,
					rows: state.words.map( ( word ) => computeRow( guess, word ) )
				} )
			]
		}
	}
} );

// --- RPC surface -----------------------------------------------------------

export class WordleRpcs extends EngineRpcs( WordleConfig, WordleSnapshot, [
	MoveRpc( "guess", GuessInput )
] ) {

	public static layer = WordleRpcs.toLayer( wordle );
}