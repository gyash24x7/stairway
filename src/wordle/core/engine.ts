import { AbstractGameEngine } from "@/shared/engine/engine";
import type { GameStructure } from "@/shared/engine/types";
import { roundRobin } from "@/shared/engine/utils";
import { dictionaries } from "@/wordle/core/dictionary";
import type {
	GuessInput,
	GuessResult,
	GuessResults,
	WordleConfig,
	WordleData,
	WordleMoves,
	WordlePlayerView,
	WordleSharedView
} from "@/wordle/core/types";

/**
 * Durable Object game engine for Wordle, a single-player word guessing game.
 * Supports configurable word count, word length, and uses a two-pass algorithm
 * for marking correct, present, and absent letters.
 */
export class WordleEngine extends AbstractGameEngine<WordleData, WordleMoves, WordleConfig, WordleSharedView, WordlePlayerView> {

	public static readonly NAME = "wordle";

	protected override readonly structure: GameStructure<WordleData, WordleMoves, WordleConfig, WordleSharedView, WordlePlayerView> = {
		name: WordleEngine.NAME,
		resolveNextPlayer: roundRobin,

		sharedView: ( { state, config } ): WordleSharedView => {
			const emptyRow = Array( config.wordLength ).fill( { letter: "", status: "absent" as const } );
			return {
				guesses: state.guesses,
				maxGuesses: state.maxGuesses,
				victory: state.victory,
				guessResults: state.words.map( ( word ) => {
					const results = state.guessResults[ word ] ?? [];
					const solvedAt = results.findIndex( ( row ) => row.every( ( r ) => r.status === "correct" ) );
					const truncated = solvedAt !== -1 ? results.slice( 0, solvedAt + 1 ) : results;
					return [
						...truncated,
						...Array( state.maxGuesses - truncated.length ).fill( emptyRow )
					];
				} )
			};
		},

		playerView: ( _data, playerId ): WordlePlayerView => ( { playerId } ),

		setup: ( { wordCount, wordLength }: WordleConfig ) => {
			const dictionary = dictionaries[ wordLength ];
			const maxGuesses = wordCount + wordLength;
			const selected = new Set<string>();

			while ( selected.size < wordCount ) {
				selected.add( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
			}

			const words = [ ...selected ];
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
						throw new Error( "No more guesses left" );
					}

					const dictionary = dictionaries[ config.wordLength ];
					if ( !dictionary.includes( guess ) ) {
						throw new Error( "The guess is not a valid word" );
					}
				},
				execute: ( { state }, _playerId, { guess }: GuessInput ) => {
					state.guesses.push( guess );

					for ( const word of state.words ) {
						const results: GuessResult[] = Array( word.length )
							.fill( null )
							.map( ( _, i ) => ( { letter: guess[ i ], status: "absent" as const } ) );

						const remaining: Record<string, number> = {};
						for ( const ch of word ) {
							remaining[ ch ] = ( remaining[ ch ] ?? 0 ) + 1;
						}

						// Pass 1: mark correct matches
						for ( let i = 0; i < word.length; i++ ) {
							if ( guess[ i ] === word[ i ] ) {
								results[ i ].status = "correct";
								remaining[ guess[ i ] ]--;
							}
						}

						// Pass 2: mark present letters from remaining pool
						for ( let i = 0; i < word.length; i++ ) {
							if ( results[ i ].status !== "correct" && ( remaining[ guess[ i ] ] ?? 0 ) > 0 ) {
								results[ i ].status = "present";
								remaining[ guess[ i ] ]--;
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

}
