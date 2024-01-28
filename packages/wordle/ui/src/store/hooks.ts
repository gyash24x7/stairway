import { calculatePositions, getAvailableLetters, type PositionData } from "@common/words";
import { trpc } from "./client";
import { useGameStore } from "./store";

// Game State Hooks
export const useGameData = () => useGameStore( state => state.gameData );
export const useIsGameCompleted = () => useGameStore( state => {
	const areAllWordsCompleted = state.gameData.words.length === state.gameData.completedWords.length;
	const areAllGuessesCompleted = state.gameData.guesses.length ===
		state.gameData.words.length + state.gameData.wordLength;
	return areAllGuessesCompleted || areAllWordsCompleted;
} );

export const useAvailableLetters = () => useGameStore( state => getAvailableLetters( state.gameData.guesses ) );

export const useGuessBlockMap = () => useGameStore( ( { gameData, currentGuess } ) => {
	const map: Record<string, PositionData[][]> = {};
	gameData.words.forEach( word => {
		map[ word ] = new Array( gameData.wordLength + gameData.wordCount ).fill( 0 ).map(
			( _, i ) => i < gameData.guesses.length
				? calculatePositions( word, gameData.guesses[ i ] )
				: new Array( gameData.wordLength ).fill( 0 ).map( ( _, index ) => {
					if ( i === gameData.guesses.length ) {
						return { letter: currentGuess[ index ], state: "empty", index };
					}
					return { letter: "", state: "empty", index };
				} )
		);
	} );
	return map;
} );

export const useCurrentGuess = () => useGameStore( state => state.currentGuess );
export const useBackspaceCurrentGuess = () => useGameStore( state => state.backspaceCurrentGuess );
export const useResetCurrentGuess = () => useGameStore( state => state.resetCurrentGuess );
export const useUpdateCurrentGuess = () => useGameStore( state => state.updateCurrentGuess );

export const useUpdateGameData = () => useGameStore( state => state.updateGameData );

// Game Action Hooks
export const useCreateGameAction = trpc.createGame.useMutation;
export const useMakeGuessMutation = trpc.makeGuess.useMutation;