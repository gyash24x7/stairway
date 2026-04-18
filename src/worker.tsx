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
import { layout, render, route } from "rwsdk/router";
import { syncedStateRoutes, SyncedStateServer } from "rwsdk/use-synced-state/worker";
import { defineApp, requestInfo } from "rwsdk/worker";

export type AppContext = {
	theme: Theme;
	themeMode: ThemeMode;
	authInfo: AuthInfo | null;
};

export { UserSession } from "@/auth/core/sessions";

SyncedStateServer.registerRoomHandler( async ( roomId = "sync", reqInfo ) => {
	const userId = reqInfo?.ctx.authInfo?.id;
	return !userId ? roomId : `${ roomId }:${ userId }`;
} );

export { SyncedStateServer };

export { WordleEngine } from "@/wordle/core/engine";
export { TicTacToeEngine } from "@/tictactoe/core/engine";
export { SplendorEngine } from "@/splendor/core/engine";
export { FishEngine } from "@/fish/core/engine";
export { CallbreakEngine } from "@/callbreak/core/engine";
export { KingdominoEngine } from "@/kingdomino/core/engine";

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

export default { fetch: app.fetch } satisfies ExportedHandler<Env>;
