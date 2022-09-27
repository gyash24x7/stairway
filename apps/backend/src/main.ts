import express from "express";
import morgan from "morgan";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { literatureExpressHandler } from "@s2h/literature/router";
import { Publisher } from "@s2h/utils";
import type { IEnhancedLitGame } from "@s2h/literature/utils";
import {
    deserializeUser,
    handleAuthCallback,
    handleGetLoggedInUser,
    handleLogout,
    requireUser
} from "@s2h/auth";

dotenv.config();

const port = process.env.PORT || 8000;
const prisma = new PrismaClient();

const app = express();
const server = http.createServer( app );
const io = new Server( server, {
    cors: {
        origin: [ "http://localhost:5173" ],
        allowedHeaders: [ "Authorization" ],
        credentials: true
    }
} );

app.use( morgan( "tiny" ) );
app.use( cookieParser() );
app.use( express.json() );
app.use( cors( { credentials: true, origin: "http://localhost:5173" } ) );
app.use( deserializeUser( prisma ) );

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

const litGamePublisher = new Publisher<IEnhancedLitGame>( literatureNameSpace );

app.get( "/api/health", async ( _req, res ) => {
    return res.send( { healthy: true } );
} );

app.get( "/api/me", requireUser( prisma ), handleGetLoggedInUser() );

app.delete( "/api/auth/logout", requireUser( prisma ), handleLogout() );

app.get( "/api/auth/callback/google", handleAuthCallback( prisma ) );

app.use(
    "/api/literature",
    [ requireUser( prisma ), literatureExpressHandler( { prisma, litGamePublisher } ) ]
);

server.listen( port, () => {
    console.log( `Server started on port ${ port }` );
} );