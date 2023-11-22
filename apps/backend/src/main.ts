import { LoggerFactory, loggerMiddleware } from "@s2h/core";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();

app.use( bodyParser.json() );
app.use( cors( {
	origin: "http://localhost:3000",
	credentials: true
} ) );
app.use( cookieParser() );
app.use( loggerMiddleware() );

const logger = LoggerFactory.getLogger();

app.listen( 8000, () => {
	logger.info( `Stairway started on localhost:8000!` );
} );