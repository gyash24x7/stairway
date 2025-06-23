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
}