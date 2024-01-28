export type LetterState = "correct" | "wrongPlace" | "wrong" | "empty";
import dictionary from "./dictionary";

export function getAvailableLetters( guesses: string[] ) {
	let letters = "abcdefghijklmnopqrstuvwxyz".split( "" );
	for ( const guess of guesses ) {
		for ( const letter of guess.toLowerCase().split( "" ) ) {
			letters = letters.filter( ( l ) => l !== letter );
		}
	}
	return letters;
}

export type PositionData = {
	letter: string;
	state: LetterState;
	index: number
}

export function calculatePositions( word: string, input: string ): PositionData[] {
	const correctLetters = word.toLowerCase().split( "" );
	const inputLetters = input.toLowerCase().split( "" );

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
		return { letter, state, index: +index };
	} );
}

export { dictionary };