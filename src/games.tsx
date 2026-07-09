import { CallbreakGamePage } from "@/callbreak/components/game-page";
import { CallbreakHomePage } from "@/callbreak/components/home-page";
import { FishGamePage } from "@/fish/components/game-page";
import { FishHomePage } from "@/fish/components/home-page";
import { KingdominoGamePage } from "@/kingdomino/components/game-page";
import { KingdominoHomePage } from "@/kingdomino/components/home-page";
import { SplendorGamePage } from "@/splendor/components/game-page";
import { SplendorHomePage } from "@/splendor/components/home-page";
import { TicTacToeGamePage } from "@/tictactoe/components/game-page";
import { TicTacToeHomePage } from "@/tictactoe/components/home-page";
import { WordleGamePage } from "@/wordle/components/game-page";
import { WordleHomePage } from "@/wordle/components/home-page";
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
