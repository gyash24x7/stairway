import type { WordleRouter } from "./wordle.router.ts";
import type { games } from "./wordle.schema.ts";

export type Router = ReturnType<WordleRouter["router"]>;
export type Game = typeof games.$inferSelect;

export * from "./wordle.module.ts";