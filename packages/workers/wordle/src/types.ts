import type { WordleEngine } from "./engine.ts";

export type PositionData = {
	letter: string;
	state: "correct" | "wrongPlace" | "wrong" | "empty";
	index: number;
};

export type GameData = {
	id: string;
	playerId: string;
	wordCount: number;
	wordLength: 4 | 5 | 6;
	words: string[];
	guesses: string[];
	guessBlocks: PositionData[][][];
	completedWords: string[];
	completed: boolean;
};

export type PlayerGameInfo = Omit<GameData, "words">;

export type PlayerId = string;
export type BasePlayerInfo = {
	id: string;
	name: string;
	username: string;
	avatar: string;
};

export type CreateGameInput = { wordCount?: number; wordLength?: 4 | 5 | 6; };
export type MakeGuessInput = { guess: string; };

export type Bindings = {
	WORDLE_DO: DurableObjectNamespace<WordleEngine>;
	WORDLE_KV: KVNamespace;
}

export type Context = { env: Bindings } & { authInfo: BasePlayerInfo };
