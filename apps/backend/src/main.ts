import { initializeAuthModule } from "@auth/core";
import { LoggerFactory, RealtimeService } from "@common/core";
import { createDatabaseClient } from "@common/data";
import { initializeLiteratureModule } from "@literature/core";
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

const dbClient = createDatabaseClient();
const realtimeService = new RealtimeService();

const apiRouter = express.Router();
const authRouter = express.Router();
const literatureRouter = express.Router();

const { authMiddleware } = initializeAuthModule( dbClient, authRouter );
apiRouter.use( "/auth", authRouter );

initializeLiteratureModule( dbClient, realtimeService, literatureRouter );
apiRouter.use( "/literature", ( req, res, next ) => authMiddleware.use( req, res, next ), literatureRouter );

app.use( "/api", apiRouter );

const logger = LoggerFactory.getLogger();
realtimeService.registerNamespace( io, "literature" );

httpServer.listen( 8000, () => {
	logger.info( `Stairway started on localhost:8000!` );
} );