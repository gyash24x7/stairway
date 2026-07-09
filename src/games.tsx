import type { ComponentType } from "react";

/** The routed components a game contributes: its home page and its per-game board page. */
export type GameModule = {
	Home: ComponentType;
	Game: ComponentType<{ gameId: string }>;
};

/**
 * Registry of playable games, keyed by the game name used in URLs and the DB.
 * Games are registered here as they are migrated (phase 5); the dynamic `$game`
 * routes dispatch through this map.
 */
export const GAME_REGISTRY: Record<string, GameModule> = {};

/** Display order of games on the home screen. */
export const GAME_NAMES = [
	"fish",
	"callbreak",
	"wordle",
	"tic-tac-toe",
	"splendor",
	"kingdomino"
] as const;
