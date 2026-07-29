import type { GuessResult, WordleEvents, WordleState } from "@s2h/schema/wordle";
import * as Match from "effect/Match";

// --- Guess-result computation (pure) ---------------------------------------

export const computeRow = ( guess: string, word: string ) => {
	const results: GuessResult[] = Array.from(
		{ length: word.length },
		( _, i ) => ( { letter: guess[ i ] ?? "", status: "absent" as const } )
	);

	const remaining: Record<string, number> = {};
	for ( const ch of word ) {
		remaining[ ch ] = ( remaining[ ch ] ?? 0 ) + 1;
	}

	// Pass 1: mark correct matches.
	for ( let i = 0; i < word.length; i++ ) {
		if ( guess[ i ] === word[ i ] ) {
			results[ i ] = { letter: guess[ i ]!, status: "correct" };
			remaining[ guess[ i ]! ]!--;
		}
	}

	// Pass 2: mark present letters from the remaining pool.
	for ( let i = 0; i < word.length; i++ ) {
		if ( results[ i ]!.status !== "correct" && ( remaining[ guess[ i ]! ] ?? 0 ) > 0 ) {
			results[ i ] = { letter: guess[ i ]!, status: "present" };
			remaining[ guess[ i ]! ]!--;
		}
	}

	return results;
};

export const allWordsGuessed = ( state: WordleState ) =>
	state.words.every( ( word ) => state.guesses.includes( word ) );

/** Pure reducer — the ONLY place `state` changes. */
export const apply = ( state: WordleState, event: WordleEvents ) =>
	Match.value( event ).pipe(
		Match.tag( "wordle/evt/Guessed", ( e ) => {
			const guesses = [ ...state.guesses, e.guess ];
			const guessResults = { ...state.guessResults };
			state.words.forEach( ( word, i ) => {
				guessResults[ word ] = [ ...( guessResults[ word ] ?? [] ), e.rows[ i ]! ];
			} );
			return { ...state, guesses, guessResults };
		} ),
		Match.tag( "wordle/evt/VictoryDecided", ( e ) => ( { ...state, victory: e.victory } ) ),
		Match.exhaustive
	);