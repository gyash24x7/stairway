export type PositionData = {
	letter: string;
	state: "correct" | "wrongPlace" | "wrong" | "empty";
	index: number;
};

export type GameData = {
	id: string;
	playerId: string;
	wordCount: number;
	wordLength: number;
	words: string[];
	guesses: string[];
	guessBlocks: PositionData[][][];
	completedWords: string[];
	completed: boolean;
};

export type PlayerGameInfo = Omit<GameData, "words">;

export type GameId = string;
export type PlayerId = string;

export type CreateGameInput = {
	wordCount?: number;
	wordLength?: number;
};

export type MakeGuessInput = {
	gameId: string;
	guess: string;
};
