import { GameEngine } from "@/shared/engine/engine";
import { createLogger } from "@/shared/utils/logger";
import { dictionaries } from "@/wordle/core/dictionary";
import type {
	GuessInput,
	GuessResult,
	GuessResults,
	GuessResultsForWord,
	WordleConfig,
	WordlePlayerView
} from "@/wordle/core/types";

const logger = createLogger( "Wordle:Engine" );

export const wordleEngine = new GameEngine( {
	name: "wordle",
	getNextPlayer: "round-robin",

	playerView: ( data, config, playerId ): WordlePlayerView => ( {
		playerId,
		guesses: data.guesses,
		maxGuesses: data.maxGuesses,
		guessResults: data.words.reduce( ( acc, word ) => {
			const results = data.guessResults[ word ] ?? [];
			const solvedAt = results.findIndex( ( row ) => row.every( ( r ) => r.status === "correct" ) );
			const truncated = solvedAt !== -1 ? results.slice( 0, solvedAt + 1 ) : results;
			const emptyGuessResultsRow = Array( config.wordLength ).fill( { letter: "", status: "absent" as const } );
			const padded = [
				...truncated,
				...Array( data.maxGuesses - truncated.length ).fill( emptyGuessResultsRow )
			];
			acc.push( padded );
			return acc;
		}, [] as GuessResultsForWord[] )
	} ),

	setup: ( { wordCount, wordLength }: WordleConfig ) => {
		const dictionary = dictionaries[ wordLength ];
		const maxGuesses = wordCount + wordLength;
		const words = Array( wordCount ).fill( "" ).map(
			() => dictionary[ Math.floor( Math.random() * dictionary.length ) ]
		);

		const guessResults = words.reduce( ( acc, word ) => {
			acc[ word ] = [];
			return acc;
		}, {} as GuessResults );

		return { words, guesses: [] as string[], guessResults, maxGuesses };
	},

	moves: {
		guess: {
			validate: ( state, config, _playerId, { guess }: GuessInput ) => {
				if ( state.data.guesses.length >= state.data.maxGuesses ) {
					logger.error( "No More Guesses Left!" );
					throw new Error( "No more guesses left" );
				}

				const dictionary = dictionaries[ config.wordLength ];
				if ( !dictionary.includes( guess ) ) {
					logger.error( "The guess is not a valid word!" );
					throw new Error( "The guess is not a valid word" );
				}
			},
			execute: ( state, _config, _playerId, { guess }: GuessInput ) => {
				state.data.guesses.push( guess );

				for ( const word of state.data.words ) {
					const results: GuessResult[] = [];
					for ( let i = 0; i < word.length; i++ ) {
						if ( guess[ i ] === word[ i ] ) {
							results.push( { letter: guess[ i ], status: "correct" } );
						} else if ( word.includes( guess[ i ] ) ) {
							results.push( { letter: guess[ i ], status: "present" } );
						} else {
							results.push( { letter: guess[ i ], status: "absent" } );
						}
					}

					state.data.guessResults[ word ].push( results );
				}

				return state.data;
			}
		}
	},

	endIf: ( state, _config ) => {
		const allWordsGuessed = state.data.words.every(
			( word: string ) => state.data.guesses.includes( word )
		);

		if ( allWordsGuessed ) {
			return { winner: state.ctx.players[ 0 ], victory: true };
		}

		if ( state.data.guesses.length >= state.data.maxGuesses ) {
			return { victory: false };
		}

		return undefined;
	}
} );
