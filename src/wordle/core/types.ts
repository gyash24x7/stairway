import type { BaseGameConfig, Match, MatchId, PlayerId } from "@/shared/engine/types";

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
};

export type WordlePlayerView = Omit<WordleData, "words" | "guessResults"> & {
	playerId: PlayerId;
	guessResults: GuessResultsForWord[];
};

export type WordleMatch = Match<WordlePlayerView, WordleConfig>;

export type GuessInput = { guess: string; matchId: MatchId; };
