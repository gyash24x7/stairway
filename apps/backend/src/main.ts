import { LiteratureModule } from "@literature/api";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { HealthModule, LoggerFactory, PostgresModule } from "@shared/api";
import { WordleModule } from "@wordle/api";
import dotenv from "dotenv";

@Module( {
	imports: [
		HealthModule,
		PostgresModule,
		WordleModule,
		LiteratureModule
	]
} )
class AppModule {}

dotenv.config();

const logger = LoggerFactory.getLogger( AppModule );

async function bootstrap() {
	const app = await NestFactory.create( AppModule );
	const host = process.env[ "HOST" ] || "localhost";
	const port = process.env[ "PORT" ] || "8000";

	app.enableCors();

	app.setGlobalPrefix( "api" );

	await app.listen( port );
	logger.log( `Stairway started on ${ host }:${ port }!` );
}

bootstrap().then();