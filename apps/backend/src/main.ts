import { LoggerFactory, PostgresModule } from "@common/core";
import { LiteratureModule } from "@literature/core";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

@Module( {
	imports: [ PostgresModule, LiteratureModule ]
} )
class AppModule {}

async function bootstrap() {
	const app = await NestFactory.create( AppModule );

	app.use( bodyParser.json() );

	app.enableCors( {
		origin: "http://localhost:3000",
		credentials: true
	} );

	app.setGlobalPrefix( "api" );

	const logger = LoggerFactory.getLogger( AppModule );
	await app.listen( 8000 );
	logger.log( `Stairway started on localhost:8000!` );
}

bootstrap().then();