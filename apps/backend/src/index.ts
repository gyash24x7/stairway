import { AuthModule } from "@backend/auth";
import { LiteratureModule } from "@backend/literature";
import { HealthModule, LoggerFactory, MailjetModule, PostgresModule } from "@backend/utils";
import { WordleModule } from "@backend/wordle";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Module( {
	imports: [
		MailjetModule,
		HealthModule,
		PostgresModule,
		AuthModule,
		WordleModule,
		LiteratureModule
	]
} )
class AppModule {}

const logger = LoggerFactory.getLogger( AppModule );
logger.debug("Env Vars: %o", Bun.env);

const app = await NestFactory.create( AppModule );
const host = process.env[ "HOST" ] || "localhost";
const port = process.env[ "PORT" ] || "8000";

app.enableCors();

app.setGlobalPrefix( "api" );

await app.listen( port );
logger.log( `Stairway started on ${ host }:${ port }!` );
