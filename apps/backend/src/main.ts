import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { AppConfig, CONFIG_DATA, LoggerFactory, loggerMiddleware } from "@s2h/core";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { LiteratureModule } from "@literature/core";
import { Server } from "socket.io";

dotenv.config();

@Module( { imports: [ LiteratureModule ] } )
export class AppModule {}

async function bootstrap() {
	const logger = LoggerFactory.getLogger( AppModule );
	const app = await NestFactory.create( AppModule );

	const httpAdapter = app.getHttpAdapter();

	const io = new Server( httpAdapter.getHttpServer(), {
		cors: {
			origin: [ "http://localhost:3000" ],
			allowedHeaders: [ "Authorization" ],
			credentials: true
		}
	} );

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