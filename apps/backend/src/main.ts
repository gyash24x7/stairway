import { LiteratureModule } from "@literature/api";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { HealthModule, LoggerFactory, PostgresModule } from "@shared/api";
import { WordleModule } from "@wordle/api";
import cookieParser from "cookie-parser";

@Module( {
	imports: [
		HealthModule,
		PostgresModule,
		WordleModule,
		LiteratureModule
	]
} )
class AppModule {}

const logger = LoggerFactory.getLogger( AppModule );

const app = await NestFactory.create( AppModule );
const host = Bun.env[ "HOST" ] ?? "localhost";
const port = Bun.env[ "PORT" ] ?? "8000";
const FRONTEND_URL = Bun.env[ "FRONTEND_URL" ] ?? "http://localhost:3000";

app.enableCors( { origin: FRONTEND_URL, credentials: true } );
app.setGlobalPrefix( "api" );
app.use( cookieParser() );

await app.listen( port );
logger.log( `Stairway started on ${ host }:${ port }!` );
