import { deserializeUser, handleAuthCallback, handleGetLoggedInUser, handleLogout, requireUser } from "@s2h/auth";
import { literatureExpressHandler, LiteratureR, literatureTrpcPanelHandler } from "@s2h/literature/router";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { IUser, Publisher } from "@s2h/utils";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import morgan from "morgan";
import { Server } from "socket.io";
import { r } from "rethinkdb-ts";
import * as console from "console";

dotenv.config();

const LITERATURE_TABLE = "literature";
const USERS_TABLE = "users";
const db: LiteratureR = {
	...r,
	literature: () => r.table<ILiteratureGame>( LITERATURE_TABLE ),
	users: () => r.table<IUser>( USERS_TABLE )
};

r.connect( { host: "personal.local", port: 28015 } )
	.then( connection => {
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

		app.use( morgan( "tiny" ) );
		app.use( cookieParser() );
		app.use( express.json() );
		app.use( cors( { credentials: true, origin: "http://localhost:3000" } ) );
		app.use( deserializeUser( db, connection ) );

		const literatureNameSpace = io.of( "/literature" );

		literatureNameSpace.on( "connection", socket => {
			console.log( "New Client Connected!" );
			console.log( `Socket: ${ socket.id }` );

			socket.emit( "welcome", { message: "Welcome to Literature!" } );

			socket.on( "disconnect", () => {
				console.log( "Client Disconnected!" );
				console.log( `Socket: ${ socket.id }` );
			} );
		} );

		const litGamePublisher = new Publisher<ILiteratureGame>( literatureNameSpace );

		app.get( "/api/health", async ( _req, res ) => {
			return res.send( { healthy: true } );
		} );

		app.get( "/api/me", requireUser( db, connection ), handleGetLoggedInUser() );

		app.delete( "/api/auth/logout", requireUser( db, connection ), handleLogout() );

		app.get( "/api/auth/callback/google", handleAuthCallback( db, connection ) );

		app.get( "/api/literature/docs", literatureTrpcPanelHandler( "http://localhost:8000/api/literature" ) );

		app.use( "/api/literature", requireUser( db, connection ), literatureExpressHandler( db, connection ) );

		server.listen( port, () => {
			console.log( `Server started on port ${ port }` );
		} );
	} )
	.catch( err => {
		console.error( "Unable to connect to DB!" );
		console.log( err );
	} );