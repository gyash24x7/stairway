import { Module } from "@nestjs/common";
import { GamesController } from "./controllers";
import { DatabaseModule } from "@s2h/core";
import { AuthModule } from "@auth/core";
import { commandHandlers } from "./commands";
import { queryHandlers } from "./queries";
import { CqrsModule } from "@nestjs/cqrs";
import { services } from "./services";

@Module( {
	imports: [ DatabaseModule, AuthModule, CqrsModule ],
	controllers: [ GamesController ],
	providers: [ ...services, ...commandHandlers, ...queryHandlers ]
} )
export class LiteratureModule {}