import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { AppConfig, CONFIG_DATA, LoggerFactory, loggerMiddleware } from "@s2h/utils";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { LiteratureModule } from "@literature/core";

dotenv.config();

@Module( { imports: [ LiteratureModule ] } )
export class AppModule {}

async function bootstrap() {
	const logger = LoggerFactory.getLogger( AppModule );
	const app = await NestFactory.create( AppModule, { logger } );

	const config = app.get<AppConfig>( CONFIG_DATA );

	app.enableCors( {
		origin: "http://localhost:3000",
		credentials: true
	} );

	app.setGlobalPrefix( "/api" );
	app.use( bodyParser.json() );
	app.use( cookieParser() );
	app.use( loggerMiddleware() );

	await app.listen( config.appInfo.port );
	logger.info( `${ config.appInfo.name } started on ${ config.appInfo.host }: ${ config.appInfo.port }!` );
}

bootstrap().then();