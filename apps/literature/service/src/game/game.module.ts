import { Module } from "@nestjs/common";
import { LiteratureService } from "./literature.service";

@Module( {
	controllers: [ LiteratureService ]
} )
export class GameModule {}