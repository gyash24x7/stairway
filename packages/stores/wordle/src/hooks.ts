import { calculatePositions, dictionary, getAvailableLetters, type PositionData } from "@stairway/words";
import { useGameStore } from "./store.ts";

export const useGameWords = () => useGameStore( state => state.game.words );
export const useGameGuesses = () => useGameStore( state => state.game.guesses );
export const useIsGameCompleted = () => useGameStore( state => {
	const areAllWordsCompleted = state.game.words.length === state.game.completedWords.length;
	const areAllGuessesCompleted = state.game.guesses.length ===
		state.game.words.length + state.game.wordLength;
	return areAllGuessesCompleted || areAllWordsCompleted;
} );

export const useAvailableLetters = () => useGameStore( state => getAvailableLetters( state.game.guesses ) );

export const useGuessBlockMap = () => useGameStore( ( { game, currentGuess } ) => {
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
} );

export const useGameId = () => useGameStore( state => state.game.id );
export const useCompletedWords = () => useGameStore( state => state.game.completedWords );
export const useCurrentGuess = () => useGameStore( state => state.currentGuess );
export const useBackspaceCurrentGuess = () => useGameStore( state => state.backspaceCurrentGuess );
export const useResetCurrentGuess = () => useGameStore( state => state.resetCurrentGuess );
export const useUpdateCurrentGuess = () => useGameStore( state => state.updateCurrentGuess );
export const useIsValidWord = () => useGameStore( state => dictionary.includes( state.currentGuess.join( "" ) ) );
export const useUpdateGameData = () => useGameStore( state => state.updateGameData );
export const useIsValidGuessLength = () => useGameStore(
	state => state.currentGuess.length === state.game.wordLength
);
