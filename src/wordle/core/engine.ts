import { AbstractGameEngine } from "@/shared/engine/engine";
import type { GameStructure } from "@/shared/engine/types";
import { dictionaries } from "@/wordle/core/dictionary";
import type {
	GuessInput,
	GuessResult,
	GuessResults,
	WordleConfig,
	WordleData,
	WordleMoves,
	WordlePlayerView
} from "@/wordle/core/types";

export class WordleEngine extends AbstractGameEngine<WordleData, WordleMoves, WordleConfig, WordlePlayerView> {

	public static readonly NAME = "wordle";

	protected override readonly structure: GameStructure<WordleData, WordleMoves, WordleConfig, WordlePlayerView> = {
		name: WordleEngine.NAME,
		getNextPlayer: "round-robin",

		playerView: ( { state, config }, playerId ): WordlePlayerView => {
			const emptyRow = Array( config.wordLength ).fill( { letter: "", status: "absent" as const } );
			return {
				playerId,
				guesses: state.guesses,
				maxGuesses: state.maxGuesses,
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

	protected getInitialState(): { state: WordleData; config: WordleConfig } {
		return {
			config: { wordCount: 1, wordLength: 5, autoStart: true, playerCount: 1 },
			state: { words: [], guesses: [], guessResults: {}, maxGuesses: 0 }
		};
	}

}
