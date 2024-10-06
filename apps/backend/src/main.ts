import { AuthModule } from "@auth/api";
import { CallBreakModule } from "@callbreak/api";
import { LiteratureModule } from "@literature/api";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ServeStaticModule } from "@nestjs/serve-static";
import { OgmaModule, OgmaService } from "@ogma/nestjs-module";
import { WordleModule } from "@wordle/api";
import cookieParser from "cookie-parser";
import path from "node:path";
import { HealthController } from "./health.controller.ts";
import { PrismaModule } from "./prisma.module.ts";

const StaticModule = ServeStaticModule.forRoot( {
	rootPath: path.join( process.cwd(), "..", "web", "dist" )
} );

const OgmaLoggerModule = OgmaModule.forRoot( {
	application: "Stairway",
	logLevel: "DEBUG"
} );

@Module( {
	imports: [
		StaticModule,
		OgmaLoggerModule,
		PrismaModule,
		AuthModule,
		WordleModule,
		LiteratureModule,
		CallBreakModule
	],
	controllers: [ HealthController ]
} )
class AppModule {}

const app = await NestFactory.create( AppModule );
const logger = app.get( OgmaService, { strict: false } );

const host = Bun.env[ "HOST" ] ?? "localhost";
const port = Bun.env[ "PORT" ] ?? "8000";
const FRONTEND_URL = Bun.env[ "FRONTEND_URL" ] ?? "http://localhost:3000";
const RAILWAY_HEALTHCHECK_URL = "healthcheck.railway.app";

app.enableCors( { origin: [ FRONTEND_URL, RAILWAY_HEALTHCHECK_URL ], credentials: true } );
app.setGlobalPrefix( "api" );
app.use( cookieParser() );

await app.listen( port );
logger.log( `Stairway started on ${ host }:${ port }!` );
