import { Module } from "@nestjs/common";
import { GamesController } from "./controllers";
import { DatabaseModule } from "@s2h/utils";
import { LiteratureService } from "./services";
import { AuthModule } from "@auth/core";

@Module( {
	imports: [ DatabaseModule, AuthModule ],
	controllers: [ GamesController ],
	providers: [ LiteratureService ]
} )
export class LiteratureModule {}