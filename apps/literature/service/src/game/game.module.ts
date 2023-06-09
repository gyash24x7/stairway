import { Module } from "@nestjs/common";
import { DatabaseModule } from "../db";
import { LiteratureService } from "./literature.service";

@Module( {
	imports: [ DatabaseModule ],
	controllers: [ LiteratureService ]
} )
export class GameModule {}