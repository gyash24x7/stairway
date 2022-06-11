import express from "express";
import morgan from "morgan";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import deserializeUser from "./middlewares/deserialize-user";
import { getLoggedInUser, handleAuthCallback, handleLogout } from "./handlers/auth";
import requireUser from "./middlewares/require-user";
import handleTrpc from "./middlewares/trpc";
import { Server } from "socket.io";

dotenv.config();

const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer( app );
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
app.use( deserializeUser );

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

app.get( "/api/health", async ( _req, res ) => {
	return res.send( { healthy: true } );
} );

app.get( "/api/me", requireUser, getLoggedInUser );

app.delete( "/api/auth/logout", requireUser, handleLogout );

app.get( "/api/auth/callback/google", handleAuthCallback );

app.use( "/api/literature", [ requireUser, handleTrpc( literatureNameSpace ) ] );

server.listen( port, () => {
	console.log( `Server started on port ${ port }` );
} );