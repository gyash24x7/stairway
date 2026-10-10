import "@/styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { AuthControl } from "@/auth/ui/control";
import { CallbreakControllerPage } from "@/games/callbreak/ui/controller-page";
import { CallbreakCouchPage } from "@/games/callbreak/ui/couch-page";
import { CallbreakGamePage } from "@/games/callbreak/ui/game-page";
import { CallbreakHomePage } from "@/games/callbreak/ui/home-page";
import { CallbreakJoinPage } from "@/games/callbreak/ui/join-page";
import { CoupGamePage } from "@/games/coup/ui/game-page";
import { CoupHomePage } from "@/games/coup/ui/home-page";
import { CoupJoinPage } from "@/games/coup/ui/join-page";
import { FishGamePage } from "@/games/fish/ui/game-page";
import { FishHomePage } from "@/games/fish/ui/home-page";
import { FishJoinPage } from "@/games/fish/ui/join-page";
import { KingdominoControllerPage } from "@/games/kingdomino/ui/controller-page";
import { KingdominoCouchPage } from "@/games/kingdomino/ui/couch-page";
import { KingdominoGamePage } from "@/games/kingdomino/ui/game-page";
import { KingdominoHomePage } from "@/games/kingdomino/ui/home-page";
import { KingdominoJoinPage } from "@/games/kingdomino/ui/join-page";
import { SplendorControllerPage } from "@/games/splendor/ui/controller-page";
import { SplendorCouchPage } from "@/games/splendor/ui/couch-page";
import { SplendorGamePage } from "@/games/splendor/ui/game-page";
import { SplendorHomePage } from "@/games/splendor/ui/home-page";
import { SplendorJoinPage } from "@/games/splendor/ui/join-page";
import { TicTacToeGamePage } from "@/games/tictactoe/ui/game-page";
import { TicTacToeHomePage } from "@/games/tictactoe/ui/home-page";
import { TicTacToeJoinPage } from "@/games/tictactoe/ui/join-page";
import { WordleGamePage } from "@/games/wordle/ui/game-page";
import { WordleHomePage } from "@/games/wordle/ui/home-page";
import { WordleJoinPage } from "@/games/wordle/ui/join-page";
import { ErrorState } from "@/shared/shell/error-state";
import { LandingPage } from "@/shared/shell/landing-page";
import { AppLayout, CouchLayout } from "@/shared/shell/layout";
import { TablesPage } from "@/shared/shell/tables-page";
import { WorldGamePage } from "@/world/ui/game-pages";

/**
 * Three games play across two screens, so they carry two extra routes each: a
 * `/couch` board for a television and a `/controller` for the phone driving it.
 * `GameInfo` links to both by exactly these paths, so a game gaining the split
 * has to be registered here as well as in its own package.
 *
 * Every game also carries a `/join` route, which is the whole of how somebody
 * is invited to one: it is what `GameInfo`'s copy button puts on the clipboard
 * and what the lobby's JOIN button links to, both by exactly this path. A game
 * missing it has no way in for anyone but its creator.
 *
 * The couch routes hang off `CouchLayout` rather than `AppLayout`. A television
 * has no pointer, so the navbar is controls nobody can reach, and its padding
 * fights a canvas that wants the whole viewport. The controller stays under the
 * app shell — a phone does want log-out, theme and a way home.
 *
 * `/world` is the walkable arena. Every game's pages are nested under it again,
 * so a table opened from inside the world shows as an overlay with the world
 * still running underneath (see `WorldPage`). These are the same components the
 * classic routes use. `GamePathProvider` keeps their in-app links under `/world`.
 */
const router = createBrowserRouter( [
	{
		element: <AppLayout><AuthControl/></AppLayout>,
		errorElement: <ErrorState action={ { label: "BACK HOME", to: "/" } }/>,
		children: [
			{ path: "/", element: <LandingPage/> },
			{ path: "/tables", element: <TablesPage/> },
			{
				path: "/world",
				// Loaded on demand: Pixi is most of its weight, and nobody who stays on
				// the classic pages should have to download it.
				lazy: async () => ( { Component: ( await import( "@/world/ui/world-page" ) ).WorldPage } ),
				children: [
					{ path: ":game", element: <WorldGamePage page={ "home" }/> },
					{ path: ":game/:gameId", element: <WorldGamePage page={ "game" }/> },
					{ path: ":game/:gameId/join", element: <WorldGamePage page={ "join" }/> }
				]
			},

			{ path: "/tictactoe", element: <TicTacToeHomePage/> },
			{ path: "/tictactoe/:gameId", element: <TicTacToeGamePage/> },
			{ path: "/tictactoe/:gameId/join", element: <TicTacToeJoinPage/> },

			{ path: "/wordle", element: <WordleHomePage/> },
			{ path: "/wordle/:gameId", element: <WordleGamePage/> },
			{ path: "/wordle/:gameId/join", element: <WordleJoinPage/> },

			{ path: "/coup", element: <CoupHomePage/> },
			{ path: "/coup/:gameId", element: <CoupGamePage/> },
			{ path: "/coup/:gameId/join", element: <CoupJoinPage/> },

			{ path: "/fish", element: <FishHomePage/> },
			{ path: "/fish/:gameId", element: <FishGamePage/> },
			{ path: "/fish/:gameId/join", element: <FishJoinPage/> },

			{ path: "/callbreak", element: <CallbreakHomePage/> },
			{ path: "/callbreak/:gameId", element: <CallbreakGamePage/> },
			{ path: "/callbreak/:gameId/join", element: <CallbreakJoinPage/> },
			{ path: "/callbreak/:gameId/controller", element: <CallbreakControllerPage/> },

			{ path: "/kingdomino", element: <KingdominoHomePage/> },
			{ path: "/kingdomino/:gameId", element: <KingdominoGamePage/> },
			{ path: "/kingdomino/:gameId/join", element: <KingdominoJoinPage/> },
			{ path: "/kingdomino/:gameId/controller", element: <KingdominoControllerPage/> },

			{ path: "/splendor", element: <SplendorHomePage/> },
			{ path: "/splendor/:gameId", element: <SplendorGamePage/> },
			{ path: "/splendor/:gameId/join", element: <SplendorJoinPage/> },
			{ path: "/splendor/:gameId/controller", element: <SplendorControllerPage/> }
		]
	},
	{
		element: <CouchLayout/>,
		errorElement: <ErrorState action={ { label: "BACK HOME", to: "/" } }/>,
		children: [
			{ path: "/callbreak/:gameId/couch", element: <CallbreakCouchPage/> },
			{ path: "/kingdomino/:gameId/couch", element: <KingdominoCouchPage/> },
			{ path: "/splendor/:gameId/couch", element: <SplendorCouchPage/> }
		]
	}
] );

const elem = document.getElementById( "root" )!;
const root = createRoot( elem );

root.render(
	<StrictMode>
		<RouterProvider router={ router }/>
	</StrictMode>
);
