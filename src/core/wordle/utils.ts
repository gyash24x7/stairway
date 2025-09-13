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
 * @param {string} currentGuess - The current guess being made by the player.
 * @returns {Record<string, PositionData[][]>} - A map where each key is a word and the value is an array of position data arrays.
 */
export function getGuessBlocks( data: GameData, currentGuess: string ): Record<string, PositionData[][]> {
	const map: Record<string, PositionData[][]> = {};
	data.words.forEach( word => {
		const completedIndex = data.guesses.indexOf( word );
		map[ word ] = new Array( data.wordLength + data.wordCount ).fill( 0 ).map(
			( _, i ) => i < data.guesses.length
				? calculatePositions( word, data.guesses[ i ], completedIndex !== -1 && i > completedIndex )
				: new Array( data.wordLength ).fill( 0 ).map( ( _, index ) => {
					if ( completedIndex > -1 ) {
						return { letter: "", state: "empty", index };
					}

					if ( i === data.guesses.length ) {
						return { letter: currentGuess[ index ], state: "empty", index };
					}

					return { letter: "", state: "empty", index };
				} )
		);
	} );
	return map;
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
