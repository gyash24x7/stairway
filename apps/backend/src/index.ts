import { AuthModule } from "@backend/auth";
import { LiteratureModule } from "@backend/literature";
import { LoggerFactory, PostgresModule } from "@backend/utils";
import { WordleModule } from "@backend/wordle";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Module( {
	imports: [ PostgresModule, AuthModule, WordleModule, LiteratureModule ]
} )
class AppModule {}

const app = await NestFactory.create( AppModule );

app.enableCors();

app.setGlobalPrefix( "api" );

const logger = LoggerFactory.getLogger( AppModule );
await app.listen( 8000 );
logger.log( `Stairway started on localhost:8000!` );