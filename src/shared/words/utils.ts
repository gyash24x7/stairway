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

export function getAvailableLetters( guesses: string[] ) {
	let letters = "abcdefghijklmnopqrstuvwxyz".split( "" );
	for ( const guess of guesses ) {
		for ( const letter of guess.toLowerCase().split( "" ) ) {
			letters = letters.filter( ( l ) => l !== letter );
		}
	}
	return letters;
}

export function getGuessBlocks( game: Game, currentGuess: string ) {
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

export function calculatePositions( word: string, input: string, isCompleted = false ): PositionData[] {
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
