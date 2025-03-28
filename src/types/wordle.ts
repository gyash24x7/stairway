import type { WordleGame } from "@prisma/client";

export namespace Wordle {
	export type Game = WordleGame

	export type Store = {
		game: Game;
		currentGuess: string[];
	}
}