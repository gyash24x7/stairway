import { deserializeUser, handleAuthCallback, handleGetLoggedInUser, handleLogout, requireUser } from "@s2h/auth";
import { literatureExpressHandler, literatureTrpcPanelHandler } from "@s2h/literature/router";
import { db, initializeSocketServer } from "@s2h/utils";
import * as console from "console";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import morgan from "morgan";

dotenv.config();

async function bootstrap() {
	const connection = await db.connect();
	const app = express();
	const server = http.createServer( app );
	const port = process.env[ "PORT" ] || 8000;

	app.use( morgan( "tiny" ) );
	app.use( cookieParser() );
	app.use( express.json() );
	app.use( cors( { credentials: true, origin: "http://localhost:3000" } ) );
	app.use( deserializeUser( connection ) );

	await initializeSocketServer( server, "literature" );

	app.get( "/api/health", async ( _req, res ) => {
		return res.send( { healthy: true } );
	} );

	app.get( "/api/me", requireUser( connection ), handleGetLoggedInUser() );

	app.delete( "/api/auth/logout", requireUser( connection ), handleLogout() );

	app.get( "/api/auth/callback/google", handleAuthCallback( connection ) );

	app.get( "/api/literature/docs", literatureTrpcPanelHandler( "http://localhost:8000/api/literature" ) );

	app.use( "/api/literature", requireUser( connection ), literatureExpressHandler( connection ) );

	server.listen( port, () => {
		console.log( `Server started on port ${ port }` );
	} );
}

bootstrap().then();