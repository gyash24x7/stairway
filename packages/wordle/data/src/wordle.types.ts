import type { wordleGames } from "./wordle.schema";

export type Game = typeof wordleGames.$inferSelect;
