import { authMiddleware, authRouter } from "@auth/core";
import { literatureRouter } from "@literature/core";
import { LoggerFactory, loggerMiddleware, realtimeService } from "@s2h/core";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import * as http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();

const httpServer = http.createServer( app );
const io = new Server( httpServer, {
	cors: {
		origin: [ "http://localhost:3000" ],
		allowedHeaders: [ "Authorization" ],
		credentials: true
	}
} );

app.use( bodyParser.json() );
app.use( cors( {
	origin: "http://localhost:3000",
	credentials: true
} ) );
app.use( cookieParser() );
app.use( loggerMiddleware() );

const apiRouter = express.Router();

apiRouter.use( "/auth", authRouter.registerRoutes() );
apiRouter.use(
	"/literature",
	( req, res, next ) => authMiddleware.use( req, res, next ),
	literatureRouter.registerRoutes()
);

app.use( "/api", apiRouter );

const logger = LoggerFactory.getLogger();

realtimeService.registerNamespace( io, "literature" );

httpServer.listen( 8000, () => {
	logger.info( `Stairway started on localhost:8000!` );
} );