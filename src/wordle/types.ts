import type * as schema from "@/wordle/schema";

export namespace Wordle {
	export type Game = typeof schema.games.$inferSelect;

	export type Store = {
		game: Game;
		currentGuess: string[];
	}
}