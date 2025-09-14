export type PositionData = {
	letter: string;
	state: "correct" | "wrongPlace" | "wrong" | "empty";
	index: number;
};

export type GameData = {
	id: string;
	playerId: string;
	wordCount: number;
	wordLength: 5;
	words: string[];
	guesses: string[];
	guessBlocks: PositionData[][][];
	completedWords: string[];
	completed: boolean;
};

export type PlayerGameInfo = Omit<GameData, "words">;

export type GameIdInput = {
	gameId: string;
};

export type CreateGameInput = {
	wordCount?: number;
	wordLength?: 5;
	gameId?: string;
};

export type MakeGuessInput = {
	gameId: string;
	guess: string;
};

export type SaveFn = ( data: GameData ) => Promise<void>;