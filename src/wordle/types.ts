export namespace Wordle {
	export type Game = {
		id: string;
		playerId: string;
		wordCount: number;
		wordLength: number;
		words: string[];
		guesses: string[];
		completedWords: string[];
	};

	export type Store = {
		game: Game;
		currentGuess: string[];
	}

	export type CreateGameInput = {
		gameId?: string;
		wordCount?: number;
		wordLength?: number;
	}

	export type MakeGuessInput = {
		gameId: string;
		guess: string;
	}
}