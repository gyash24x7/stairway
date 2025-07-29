import { handleLoginVerification, handleLogout, handleRegistrationVerification } from "@/auth/server/handlers";
import type { AuthInfo, Session } from "@/auth/types";
import { Document } from "@/document";
import { loadAuthInfo, requireAuthInfo, setCommonHeaders, verifyMethod } from "@/middlewares";
import { Home } from "@/routes";
import { CallbreakHome } from "@/routes/callbreak";
import { CallbreakGame } from "@/routes/callbreak.$gameId";
import { LiteratureHome } from "@/routes/literature";
import { LiteratureGame } from "@/routes/literature.$gameId";
import { Settings } from "@/routes/settings";
import { WordleHome } from "@/routes/wordle";
import { WordleGame } from "@/routes/wordle.$gameId";
import { RootLayout } from "@/shared/components/root-layout";
import { env } from "cloudflare:workers";
import { realtimeRoute } from "rwsdk/realtime/worker";
import { layout, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

export { RealtimeDurableObject } from "rwsdk/realtime/durableObject";
export { WordleDurableObject } from "@/wordle/server/durable.object";
export { FishWorkflow } from "@/fish/server/workflow";
export { CallbreakDurableObject } from "@/callbreak/server/durable.object";

export type AppContext = {
	session?: Session;
	authInfo?: AuthInfo;
};

export default defineApp( [
	setCommonHeaders(),
	loadAuthInfo(),
	realtimeRoute( () => env.REALTIME_DURABLE_OBJECT ),
	route( "/auth/logout", [ verifyMethod( "DELETE" ), requireAuthInfo(), handleLogout ] ),
	route( "/auth/registration", [ verifyMethod( "POST" ), handleRegistrationVerification ] ),
	route( "/auth/login", [ verifyMethod( "POST" ), handleLoginVerification ] ),
	render( Document, [
		layout( RootLayout, [
			route( "/", Home ),
			route( "/settings", Settings ),
			route( "/callbreak", CallbreakHome ),
			route( "/callbreak/:gameId", [ requireAuthInfo(), CallbreakGame ] ),
			route( "/literature", LiteratureHome ),
			route( "/literature/:gameId", [ requireAuthInfo(), LiteratureGame ] ),
			route( "/wordle", WordleHome ),
			route( "/wordle/:gameId", [ requireAuthInfo(), WordleGame ] )
		] )
	] )
] );
