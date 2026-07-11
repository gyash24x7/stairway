import { CallbreakGamePage, CallbreakHomePage } from "@s2h-ui/callbreak";
import { FishGamePage, FishHomePage } from "@s2h-ui/fish";
import { KingdominoGamePage, KingdominoHomePage } from "@s2h-ui/kingdomino";
import { SplendorGamePage, SplendorHomePage } from "@s2h-ui/splendor";
import { TicTacToeGamePage, TicTacToeHomePage } from "@s2h-ui/tictactoe";
import { WordleGamePage, WordleHomePage } from "@s2h-ui/wordle";
import type { ComponentType } from "react";

/** The routed components a game contributes: its home page and its per-game board page. */
export type GameModule = {
	Home: ComponentType;
	Game: ComponentType<{ gameId: string }>;
};

/**
 * Registry of playable games, keyed by the game name used in URLs and the DB.
 * The dynamic `$game` routes dispatch through this map.
 */
export const GAME_REGISTRY: Record<string, GameModule> = {
	"wordle": { Home: WordleHomePage, Game: WordleGamePage },
	"tic-tac-toe": { Home: TicTacToeHomePage, Game: TicTacToeGamePage },
	"splendor": { Home: SplendorHomePage, Game: SplendorGamePage },
	"fish": { Home: FishHomePage, Game: FishGamePage },
	"callbreak": { Home: CallbreakHomePage, Game: CallbreakGamePage },
	"kingdomino": { Home: KingdominoHomePage, Game: KingdominoGamePage }
};

/** Display order of games on the home screen. */
export const GAME_NAMES = [
	"fish",
	"callbreak",
	"wordle",
	"tic-tac-toe",
	"splendor",
	"kingdomino"
] as const;
