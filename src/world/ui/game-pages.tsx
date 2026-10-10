import type { ComponentType } from "react";
import { useParams } from "react-router";

import { CallbreakGamePage } from "@/games/callbreak/ui/game-page";
import { CallbreakHomePage } from "@/games/callbreak/ui/home-page";
import { CallbreakJoinPage } from "@/games/callbreak/ui/join-page";
import { CoupGamePage } from "@/games/coup/ui/game-page";
import { CoupHomePage } from "@/games/coup/ui/home-page";
import { CoupJoinPage } from "@/games/coup/ui/join-page";
import { FishGamePage } from "@/games/fish/ui/game-page";
import { FishHomePage } from "@/games/fish/ui/home-page";
import { FishJoinPage } from "@/games/fish/ui/join-page";
import { KingdominoGamePage } from "@/games/kingdomino/ui/game-page";
import { KingdominoHomePage } from "@/games/kingdomino/ui/home-page";
import { KingdominoJoinPage } from "@/games/kingdomino/ui/join-page";
import { SplendorGamePage } from "@/games/splendor/ui/game-page";
import { SplendorHomePage } from "@/games/splendor/ui/home-page";
import { SplendorJoinPage } from "@/games/splendor/ui/join-page";
import { TicTacToeGamePage } from "@/games/tictactoe/ui/game-page";
import { TicTacToeHomePage } from "@/games/tictactoe/ui/home-page";
import { TicTacToeJoinPage } from "@/games/tictactoe/ui/join-page";
import { WordleGamePage } from "@/games/wordle/ui/game-page";
import { WordleHomePage } from "@/games/wordle/ui/home-page";
import { WordleJoinPage } from "@/games/wordle/ui/join-page";
import type { GameName } from "@/shared/games";
import { isGameName } from "@/shared/games";
import { ErrorState } from "@/shared/shell/error-state";


type GamePages = {
	readonly home: ComponentType;
	readonly game: ComponentType;
	readonly join: ComponentType;
};

/**
 * The pages each game already has, so the world can show them in its overlay.
 *
 * These are the same components the classic routes in `src/main.tsx` use, with
 * nothing changed. They read `:gameId` from the URL, and the world's routes
 * name that parameter the same way. A `Record` keyed by `GameName`, so a game
 * added to the registry without its pages here fails to typecheck.
 */
const PAGES: Record<GameName, GamePages> = {
	callbreak: { home: CallbreakHomePage, game: CallbreakGamePage, join: CallbreakJoinPage },
	coup: { home: CoupHomePage, game: CoupGamePage, join: CoupJoinPage },
	fish: { home: FishHomePage, game: FishGamePage, join: FishJoinPage },
	kingdomino: { home: KingdominoHomePage, game: KingdominoGamePage, join: KingdominoJoinPage },
	splendor: { home: SplendorHomePage, game: SplendorGamePage, join: SplendorJoinPage },
	tictactoe: { home: TicTacToeHomePage, game: TicTacToeGamePage, join: TicTacToeJoinPage },
	wordle: { home: WordleHomePage, game: WordleGamePage, join: WordleJoinPage }
};

/** Renders a game's page for the `:game` the URL names: `/world/:game`, `/world/:game/:gameId`, `/world/:game/:gameId/join`. */
export function WorldGamePage( { page }: { page: keyof GamePages } ) {
	const { game } = useParams();
	if ( !game || !isGameName( game ) ) {
		return <ErrorState message={ "There is no such game." }
											 action={ { label: "BACK TO THE ARENA", to: "/world" } }/>;
	}
	const Page = PAGES[ game ][ page ];
	return <Page/>;
}
