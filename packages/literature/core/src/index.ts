import { Module } from "@nestjs/common";
import { GamesController } from "./controllers";
import { DatabaseModule, RealtimeModule } from "@s2h/core";
import { AuthModule } from "@auth/core";
import { commandHandlers } from "./commands";
import { queryHandlers } from "./queries";
import { CqrsModule } from "@nestjs/cqrs";
import { services } from "./services";
import { eventHandlers } from "./events";

@Module( {
	imports: [ DatabaseModule, AuthModule, CqrsModule, RealtimeModule ],
	controllers: [ GamesController ],
	providers: [ ...services, ...commandHandlers, ...queryHandlers, ...eventHandlers ]
} )
export class LiteratureModule {}