import type { GameData, PositionData } from "@/core/wordle/schema";

/**
 * Returns the available letters based on the guesses made.
 * @param {string[]} guesses - An array of strings representing the guesses made.
 * @returns {string[]} - An array of letters that are not present in the guesses.
 */
export function getAvailableLetters( guesses: string[] ): string[] {
	let letters = "abcdefghijklmnopqrstuvwxyz".split( "" );
	for ( const guess of guesses ) {
		for ( const letter of guess.toLowerCase().split( "" ) ) {
			letters = letters.filter( ( l ) => l !== letter );
		}
	}
	return letters;
}

/**
 * Returns a map of words to their corresponding position data based on the current data state.
 * @param {GameData} data - The current data state containing words and guesses.
 * @returns {PositionData[][][]>} - Array of guess blocks for each word
 */
export function getGuessBlocks( { guesses, wordCount, wordLength, words }: GameData ): PositionData[][][] {
	return words.map( word => {
		const completedIndex = guesses.indexOf( word );
		return new Array( wordLength + wordCount ).fill( 0 ).map( ( _, i ) => i < guesses.length
			? calculatePositions( word, guesses[ i ], completedIndex !== -1 && i > completedIndex )
			: new Array( wordLength ).fill( 0 ).map( ( _, index ) => ( { letter: "", state: "empty", index } ) ) );
	} );
}

/**
 * Calculates the positions of letters in a word based on the input string.
 * @param {string} word - The target word to compare against.
 * @param {string} input - The player's input string.
 * @param {boolean} isCompleted - Indicates if the word has already been guessed correctly.
 * @returns {PositionData[]} - An array of position data for each letter in the input.
 */
export function calculatePositions( word: string, input: string, isCompleted: boolean = false ): PositionData[] {
	const correctLetters = word.toLowerCase().split( "" );
	const inputLetters = input.toLowerCase().split( "" );

	if ( isCompleted ) {
		return inputLetters.map( ( _, index ) => ( { letter: "", state: "empty", index } ) );
	}

	let remainingCharacters = [ ...correctLetters ];
	return inputLetters.map( ( letter, index ) => {
		let state: PositionData["state"] = "wrong";
		if ( correctLetters[ index ] === letter ) {
			state = "correct";
			remainingCharacters.splice( remainingCharacters.indexOf( letter ), 1 );
		} else if ( remainingCharacters.includes( letter ) ) {
			state = "wrongPlace";
			remainingCharacters.splice( remainingCharacters.indexOf( letter ), 1 );
		}
		return { letter, state, index };
	} );
}
