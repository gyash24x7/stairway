import { AbstractGameEngine } from "@/shared/engine/engine";
import type { GameStructure } from "@/shared/engine/types";
import { dictionaries } from "@/wordle/core/dictionary";
import type {
	GuessInput,
	GuessResult,
	GuessResults,
	GuessResultsForWord,
	WordleConfig,
	WordleData,
	WordleMoves,
	WordlePlayerView
} from "@/wordle/core/types";

export class WordleEngine extends AbstractGameEngine<WordleData, WordleMoves, WordleConfig, WordlePlayerView> {

	protected override readonly structure: GameStructure<WordleData, WordleMoves, WordleConfig, WordlePlayerView> = {
		name: "wordle",
		getNextPlayer: "round-robin",

		playerView: ( { state, config }, playerId ): WordlePlayerView => ( {
			playerId,
			guesses: state.guesses,
			maxGuesses: state.maxGuesses,
			guessResults: state.words.reduce( ( acc, word ) => {
				const results = state.guessResults[ word ] ?? [];
				const solvedAt = results.findIndex( ( row ) => row.every( ( r ) => r.status === "correct" ) );
				const truncated = solvedAt !== -1 ? results.slice( 0, solvedAt + 1 ) : results;
				const emptyGuessResultsRow = Array( config.wordLength )
					.fill( { letter: "", status: "absent" as const } );
				const padded = [
					...truncated,
					...Array( state.maxGuesses - truncated.length ).fill( emptyGuessResultsRow )
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
				validate: ( { state, config }, _playerId, { guess }: GuessInput ) => {
					if ( state.guesses.length >= state.maxGuesses ) {
						this.logger.error( "No More Guesses Left!" );
						throw new Error( "No more guesses left" );
					}

					const dictionary = dictionaries[ config.wordLength ];
					if ( !dictionary.includes( guess ) ) {
						this.logger.error( "The guess is not a valid word!" );
						throw new Error( "The guess is not a valid word" );
					}
				},
				execute: ( { state }, _playerId, { guess }: GuessInput ) => {
					state.guesses.push( guess );

					for ( const word of state.words ) {
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

						state.guessResults[ word ].push( results );
					}

					return state;
				}
			}
		},

		endIf: ( { state } ) => {
			const allWordsGuessed = state.words.every(
				( word: string ) => state.guesses.includes( word )
			);

			return allWordsGuessed || state.guesses.length === state.maxGuesses;
		},

		hooks: {
			onEnd: ( { state } ) => {
				const allWordsGuessed = state.words.every(
					( word: string ) => state.guesses.includes( word )
				);

				if ( allWordsGuessed ) {
					state.victory = true;
					return state;
				}

				if ( state.guesses.length === state.maxGuesses ) {
					state.victory = false;
					return state;
				}

				return state;
			}
		}
	};

	protected getInitialState(): { state: WordleData; config: WordleConfig } {
		return {
			config: { wordCount: 1, wordLength: 5, autoStart: true, playerCount: 1 },
			state: { words: [], guesses: [], guessResults: {}, maxGuesses: 0 }
		};
	}

}
