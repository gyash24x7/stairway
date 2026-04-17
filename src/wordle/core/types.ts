import type { BaseGameConfig, BaseGameData, BasePlayerView, GameData, GameId } from "@/shared/engine/types";

export type WordLength = 4 | 5 | 6;
export type LetterStatus = "correct" | "present" | "absent";
export type GuessResult = { letter: string; status: LetterStatus; };
export type GuessResultsForWord = GuessResult[][];
export type GuessResults = Record<string, GuessResultsForWord>;
export type WordleConfig = BaseGameConfig & { wordCount: number; wordLength: WordLength; };

export type WordleData = {
	words: string[];
	guesses: string[];
	guessResults: GuessResults;
	maxGuesses: number;
	victory?: boolean;
};

export type WordlePlayerView = Omit<WordleData, "words" | "guessResults"> & BasePlayerView & {
	guessResults: GuessResultsForWord[];
};

export type WordleGame = BaseGameData & GameData<WordlePlayerView, WordleConfig>;

export type CreateGameInput = { wordCount: number; wordLength: WordLength; };
export type GuessInput = { guess: string; gameId: GameId; };

export type WordleMoves = { guess: GuessInput };
