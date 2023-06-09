import { deserializeUser, handleAuthCallback, handleGetLoggedInUser, handleLogout, requireUser } from "@s2h/auth";
import { Db, literatureExpressHandler, literatureTrpcPanelHandler } from "@s2h/literature/router";
import { IUser, logger, loggerMiddleware } from "@s2h/utils";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import process from "process";
import { r } from "rethinkdb-ts";
import { ILiteratureGame } from "@s2h/literature/utils";
import { Server } from "socket.io";

dotenv.config();

const USERS_TABLE = "users";
export const LITERATURE_TABLE = "literature";

async function bootstrap() {
	const connection = await r.connect( { host: "personal.local", port: 28015 } );
	const database = r.db( "stairway" );
	const app = express();
	const server = http.createServer( app );
	const port = process.env[ "PORT" ] || 8000;

	const io = new Server( server, {
		cors: {
			origin: [ "http://localhost:3000" ],
			allowedHeaders: [ "Authorization" ],
			credentials: true
		}
	} );

	const db: Db = {
		users: () => database.table<IUser>( USERS_TABLE ),
		games: () => database.table<ILiteratureGame>( LITERATURE_TABLE )
	};

	app.use( cookieParser() );
	app.use( express.json() );
	app.use( cors( { credentials: true, origin: "http://localhost:3000" } ) );
	app.use( loggerMiddleware() );
	app.use( deserializeUser( connection, db ) );

	app.get( "/api/health", async ( _req, res ) => {
		return res.send( { healthy: true } );
	} );

	app.get( "/api/me", requireUser( connection, db ), handleGetLoggedInUser() );

	app.delete( "/api/auth/logout", requireUser( connection, db ), handleLogout() );

	app.get( "/api/auth/callback/google", handleAuthCallback( connection, db ) );

	app.get( "/api/literature/docs", literatureTrpcPanelHandler( "http://localhost:8000/api/literature" ) );

	app.use( "/api/literature", requireUser( connection, db ), literatureExpressHandler( io, connection, db ) );

	server.listen( port, () => {
		logger.info( `Server started on port ${ port }` );
	} );
}

bootstrap().then();