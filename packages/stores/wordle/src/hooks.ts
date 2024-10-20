import { dictionary, getAvailableLetters, getGuessBlocks } from "@stairway/words";
import { wordle$ } from "./store.ts";

export const useGameWords = () => wordle$.game.words.get();
export const useGameGuesses = () => wordle$.game.guesses.get();
export const useAvailableLetters = () => getAvailableLetters( wordle$.game.guesses.get() );
export const useGuessBlockMap = () => getGuessBlocks( wordle$.game.get(), wordle$.currentGuess.get().join( "" ) );
export const useGameId = () => wordle$.game.id.get();
export const useCompletedWords = () => wordle$.game.completedWords.get();
export const useCurrentGuess = () => wordle$.currentGuess.get();
export const useIsValidWord = () => dictionary.includes( wordle$.currentGuess.get().join( "" ) );
export const useIsValidGuessLength = () => wordle$.currentGuess.get().length === wordle$.game.wordLength.get();
export const useIsGameCompleted = () => {
	const words = wordle$.game.words.get();
	const completedWords = wordle$.game.completedWords.get();
	const guesses = wordle$.game.guesses.get();

	const areAllWordsCompleted = words.length === completedWords.length;
	const areAllGuessesCompleted = guesses.length === words.length + wordle$.game.wordLength.get();
	return areAllGuessesCompleted || areAllWordsCompleted;
};
