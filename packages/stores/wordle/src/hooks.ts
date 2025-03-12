import { dictionary, getAvailableLetters } from "@stairway/words";
import { useShallow } from "zustand/shallow";
import { useGameStore } from "./store";

export const useGame = () => useGameStore( state => state.game );

export const useIsGameCompleted = () => useGameStore( state => {
	const areAllWordsCompleted = state.game.words.length === state.game.completedWords.length;
	const areAllGuessesCompleted = state.game.guesses.length ===
		state.game.words.length + state.game.wordLength;
	return areAllGuessesCompleted || areAllWordsCompleted;
} );

export const useAvailableLetters = () => useGameStore( useShallow( state => {
	return getAvailableLetters( state.game.guesses );
} ) );

export const useGameId = () => useGameStore( state => state.game.id );

export const useCurrentGuess = () => useGameStore( state => state.currentGuess );

export const useBackspaceCurrentGuess = () => useGameStore( state => state.backspaceCurrentGuess );

export const useResetCurrentGuess = () => useGameStore( state => state.resetCurrentGuess );

export const useUpdateCurrentGuess = () => useGameStore( state => state.updateCurrentGuess );

export const useIsValidWord = () => useGameStore( state => {
	return dictionary.includes( state.currentGuess.join( "" ) );
} );

export const useUpdateGameData = () => useGameStore( state => state.updateGameData );

export const useIsValidGuessLength = () => useGameStore( state => {
	return state.currentGuess.length === state.game.wordLength;
} );
