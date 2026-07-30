import {
	GuessedEvent,
	GuessInput,
	GuessRow,
	VictoryDecidedEvent,
	WordleConfig,
	WordleEvents,
	WordlePlayerView,
	WordleState,
	WordleTableView,
	WordleView
} from "@s2h/schema/wordle";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import type { ReadonlyGameData } from "@s2h/swish/structure";
import { defineView } from "@s2h/swish/views";
import { dictionaries } from "./dictionary.ts";
import { allWordsGuessed, apply, computeRow } from "./utils.ts";


// --- View projection (shared board, per-audience wrappers via defineView) ---

/** The public board fields both audiences see, with unsolved rows padded to `maxGuesses`. */
const sharedView = ( { state, config }: ReadonlyGameData<WordleState, WordleConfig> ) => {
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
};


// --- Engine ----------------------------------------------------------------

export const wordle = makeEngine<
	"wordle",
	WordleState,
	WordleConfig,
	{ guess: typeof GuessInput },
	Record<string, never>,
	WordleEvents,
	WordleView
>( {
	name: "wordle",
	schemas: {
		state: WordleState,
		config: WordleConfig,
		events: WordleEvents,
		view: WordleView,
		moves: {
			guess: GuessInput
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

	view: defineView( {
		table: ( data ) => WordleTableView.make( sharedView( data ) ),
		player: ( data, id ) => WordlePlayerView.make( { ...sharedView( data ), playerId: id } )
	} ),

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
