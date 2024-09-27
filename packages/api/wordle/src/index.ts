import type { WordleGame } from "@prisma/client";
import type { WordleRouter } from "./wordle.router.ts";

export type Router = ReturnType<WordleRouter["router"]>;
export type Game = WordleGame

export * from "./wordle.module.ts";