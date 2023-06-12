import { Module } from "@nestjs/common";
import { DatabaseModule } from "@s2h/utils";
import { LiteratureService } from "./services";

@Module( {
	imports: [ DatabaseModule ],
	providers: [ LiteratureService ]
} )
export class LiteratureModule {}
