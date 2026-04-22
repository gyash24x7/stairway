import type { BaseGameConfig, BaseGameData, BasePlayerView, GameData, GameId } from "@/shared/engine/types";

/** Supported word lengths for Wordle games. */
export type WordLength = 4 | 5 | 6;

/** Status of a guessed letter: correct position, present but wrong position, or absent. */
export type LetterStatus = "correct" | "present" | "absent";

/** A single letter result containing the letter and its status. */
export type GuessResult = { letter: string; status: LetterStatus; };

/** Array of guess results for each guess attempt against a single word. */
export type GuessResultsForWord = GuessResult[][];

/** Map of target words to their guess result arrays. */
export type GuessResults = Record<string, GuessResultsForWord>;

/** Wordle game configuration with word count and word length. */
export type WordleConfig = BaseGameConfig & { wordCount: number; wordLength: WordLength; };

/** Server-side Wordle game state with target words, guesses, and results. */
export type WordleData = {
	words: string[];
	guesses: string[];
	guessResults: GuessResults;
	maxGuesses: number;
	victory?: boolean;
};

/** Player view hiding target words and showing only guess results per word. */
export type WordlePlayerView = Omit<WordleData, "words" | "guessResults"> & BasePlayerView & {
	guessResults: GuessResultsForWord[];
};

/** Complete Wordle game data type. */
export type WordleGame = BaseGameData & GameData<WordlePlayerView, WordleConfig>;

/** Input for creating a new Wordle game with word count and length. */
export type CreateGameInput = { wordCount: number; wordLength: WordLength; };

/** Input for submitting a guess word. */
export type GuessInput = { guess: string; gameId: GameId; };

/** Map of Wordle move types to their input types. */
export type WordleMoves = { guess: GuessInput };
