import { LiteratureModule } from "@literature/api";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ServeStaticModule } from "@nestjs/serve-static";
import { HealthModule, LoggerFactory, PostgresModule } from "@shared/api";
import { WordleModule } from "@wordle/api";
import cookieParser from "cookie-parser";
import path from "node:path";

const StaticModule = ServeStaticModule.forRoot( {
	rootPath: path.join( process.cwd(), "..", "web", "dist" )
} );

@Module( {
	imports: [
		StaticModule,
		HealthModule,
		PostgresModule,
		WordleModule,
		LiteratureModule
	]
} )
class AppModule {}

const logger = LoggerFactory.getLogger( AppModule );
logger.debug( "Env: %o", Bun.env );

const app = await NestFactory.create( AppModule );
const host = Bun.env[ "HOST" ] ?? "localhost";
const port = Bun.env[ "PORT" ] ?? "8000";
const FRONTEND_URL = Bun.env[ "FRONTEND_URL" ] ?? "http://localhost:3000";
const RAILWAY_HEALTHCHECK_URL = "healthcheck.railway.app";

app.enableCors( { origin: [ FRONTEND_URL, RAILWAY_HEALTHCHECK_URL ], credentials: true } );
app.setGlobalPrefix( "api" );
app.use( cookieParser() );

await app.listen( port );
logger.log( `Stairway started on ${ host }:${ port }!` );
