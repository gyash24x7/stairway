import { Module } from "@nestjs/common";
import { GameModule } from "./game";

@Module( { imports: [ GameModule ] } )
export class AppModule {}
