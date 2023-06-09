import { Module } from "@nestjs/common";
import { DatabaseModule } from "./db";
import { GameModule } from "./game";

@Module( { imports: [ DatabaseModule, GameModule ] } )
export class AppModule {}
