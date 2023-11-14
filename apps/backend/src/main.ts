import { AuthModule } from "@auth/core";
import { LiteratureModule } from "@literature/core";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { LoggerFactory, loggerMiddleware, PrismaModule, RealtimeModule } from "@s2h/core";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

@Module( {
	imports: [ PrismaModule, RealtimeModule, AuthModule, LiteratureModule ]
} )
export class AppModule {}

async function bootstrap() {
	const logger = LoggerFactory.getLogger( AppModule );
	const app = await NestFactory.create( AppModule, { logger } );

	app.enableCors( {
		origin: "http://localhost:3000",
		credentials: true
	} );

	app.setGlobalPrefix( "/api" );
	app.use( bodyParser.json() );
	app.use( cookieParser() );
	app.use( loggerMiddleware() );

	await app.listen( 8000 );
	logger.info( `Stairway started on localhost:8000!` );
}

bootstrap().then();