export type LetterState = "correct" | "wrongPlace" | "wrong" | "empty";

type Game = {
	wordLength: number;
	wordCount: number;
	words: string[];
	guesses: string[];
}

export type PositionData = {
	letter: string;
	state: LetterState;
	index: number
}

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
 * Returns a map of words to their corresponding position data based on the current game state.
 * @param {Game} game - The current game state containing words and guesses.
 * @param {string} currentGuess - The current guess being made by the player.
 * @returns {Record<string, PositionData[][]>} - A map where each key is a word and the value is an array of position data arrays.
 */
export function getGuessBlocks( game: Game, currentGuess: string ): Record<string, PositionData[][]> {
	const map: Record<string, PositionData[][]> = {};
	game.words.forEach( word => {
		const completedIndex = game.guesses.indexOf( word );
		map[ word ] = new Array( game.wordLength + game.wordCount ).fill( 0 ).map(
			( _, i ) => i < game.guesses.length
				? calculatePositions( word, game.guesses[ i ], completedIndex !== -1 && i > completedIndex )
				: new Array( game.wordLength ).fill( 0 ).map( ( _, index ) => {
					if ( completedIndex > -1 ) {
						return { letter: "", state: "empty", index };
					}

					if ( i === game.guesses.length ) {
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
 * @param {boolean} isCompleted - Indicates if the game is completed.
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
		let state: LetterState = "wrong";
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
