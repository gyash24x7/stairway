import { sessionStore } from "@/auth/core/sessions";
import type { AuthInfo } from "@/auth/core/types";
import { CallbreakGamePage } from "@/callbreak/components/game-page";
import { CallbreakHomePage } from "@/callbreak/components/home-page";
import { Document } from "@/document";
import { FishGamePage } from "@/fish/components/game-page";
import { FishHomePage } from "@/fish/components/home-page";
import { setCommonHeaders } from "@/headers";
import { KingdominoGamePage } from "@/kingdomino/components/game-page";
import { KingdominoHomePage } from "@/kingdomino/components/home-page";
import { HomePage } from "@/shared/components/home-page";
import { AppLayout } from "@/shared/components/layout";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { Theme, ThemeMode } from "@/shared/utils/cn";
import { requireauthInfo } from "@/shared/utils/middlewares";
import { SplendorGamePage } from "@/splendor/components/game-page";
import { SplendorHomePage } from "@/splendor/components/home-page";
import { TicTacToeGamePage } from "@/tictactoe/components/game-page";
import { TicTacToeHomePage } from "@/tictactoe/components/home-page";
import { WordleGamePage } from "@/wordle/components/game-page";
import { WordleHomePage } from "@/wordle/components/home-page";
import { env } from "cloudflare:workers";
import * as cookie from "cookie";
import { and, eq, inArray, lt } from "drizzle-orm";
import { layout, render, route } from "rwsdk/router";
import { syncedStateRoutes } from "rwsdk/use-synced-state/worker";
import { defineApp, requestInfo } from "rwsdk/worker";

/** Application context type available in request handlers, carrying theme and auth info. */
export type AppContext = {
	theme: Theme;
	themeMode: ThemeMode;
	authInfo: AuthInfo | null;
};

export { UserSession } from "@/auth/core/sessions";
export { SyncedStateServer } from "rwsdk/use-synced-state/worker";
export { WordleEngine } from "@/wordle/core/engine";
export { TicTacToeEngine } from "@/tictactoe/core/engine";
export { SplendorEngine } from "@/splendor/core/engine";
export { FishEngine } from "@/fish/core/engine";
export { CallbreakEngine } from "@/callbreak/core/engine";
export { KingdominoEngine } from "@/kingdomino/core/engine";

/** Main application definition with middleware chain (headers, theme, auth) and game routes. */
export const app = defineApp( [
	setCommonHeaders(),

	function loadTheme( { ctx, request } ) {
		const cookieHeader = request.headers.get( "Cookie" ) ?? "";
		const { theme = "apple-light" } = cookie.parseCookie( cookieHeader );
		ctx.theme = theme.split( "-" )[ 0 ] as Theme;
		ctx.themeMode = theme.split( "-" )[ 1 ] as ThemeMode;
	},

	async function loadAuthInfo() {
		const session = await sessionStore.load( requestInfo.request );
		requestInfo.ctx.authInfo = session?.authInfo ?? null;
	},

	...syncedStateRoutes( () => env.SYNCED_STATE_SERVER ),

	render( Document, [
		layout( AppLayout, [
			route( "/", HomePage ),

			route( "/wordle", WordleHomePage ),
			route( "/wordle/:gameId", [ requireauthInfo, WordleGamePage ] ),

			route( "/tic-tac-toe", TicTacToeHomePage ),
			route( "/tic-tac-toe/:gameId", [ requireauthInfo, TicTacToeGamePage ] ),

			route( "/splendor", SplendorHomePage ),
			route( "/splendor/:gameId", [ requireauthInfo, SplendorGamePage ] ),

			route( "/fish", FishHomePage ),
			route( "/fish/:gameId", [ requireauthInfo, FishGamePage ] ),

			route( "/callbreak", CallbreakHomePage ),
			route( "/callbreak/:gameId", [ requireauthInfo, CallbreakGamePage ] ),

			route( "/kingdomino", KingdominoHomePage ),
			route( "/kingdomino/:gameId", [ requireauthInfo, KingdominoGamePage ] )
		] )
	] )
] );

/** Maps game names (stored in DB) to their corresponding DO namespace binding keys on Env. */
const gameBindings: Record<string, keyof Pick<Env,
	"WORDLE_ENGINE" | "TIC_TAC_TOE_ENGINE" | "SPLENDOR_ENGINE" |
	"FISH_ENGINE" | "CALLBREAK_ENGINE" | "KINGDOMINO_ENGINE"
>> = {
	"wordle": "WORDLE_ENGINE",
	"tic-tac-toe": "TIC_TAC_TOE_ENGINE",
	"splendor": "SPLENDOR_ENGINE",
	"fish": "FISH_ENGINE",
	"callbreak": "CALLBREAK_ENGINE",
	"kingdomino": "KINGDOMINO_ENGINE"
};

function getGameStub( game: string, gameId: string ) {
	switch ( game ) {
		case "wordle":
			return env.WORDLE_ENGINE.get( env.WORDLE_ENGINE.idFromName( `${ game }:${ gameId }` ) );
		case "tic-tac-toe":
			return env.TIC_TAC_TOE_ENGINE.get( env.TIC_TAC_TOE_ENGINE.idFromName( `${ game }:${ gameId }` ) );
		case "splendor":
			return env.SPLENDOR_ENGINE.get( env.SPLENDOR_ENGINE.idFromName( `${ game }:${ gameId }` ) );
		case "kingdomino":
			return env.KINGDOMINO_ENGINE.get( env.KINGDOMINO_ENGINE.idFromName( `${ game }:${ gameId }` ) );
		case "fish":
			return env.FISH_ENGINE.get( env.FISH_ENGINE.idFromName( `${ game }:${ gameId }` ) );
		case "callbreak":
			return env.CALLBREAK_ENGINE.get( env.WORDLE_ENGINE.idFromName( `${ game }:${ gameId }` ) );
	}

	return null;
}

export default {
	fetch: app.fetch,

	async scheduled() {
		const twoDaysAgo = Date.now() / 1000 - 2 * 24 * 60 * 60;

		const staleGames = await db
			.select()
			.from( games )
			.where( and( eq( games.completed, 0 ), lt( games.createdAt, twoDaysAgo ) ) );

		for ( const game of staleGames ) {
			const bindingKey = gameBindings[ game.game ];
			if ( !bindingKey ) {
				continue;
			}

			const stub = getGameStub( game.game, game.id );
			if ( stub ) {
				await stub.cleanup();
			}
		}

		if ( staleGames.length > 0 ) {
			const staleIds = staleGames.map( g => g.id );
			await db.delete( games ).where( inArray( games.id, staleIds ) );
		}
	}
} satisfies ExportedHandler<Env>;
