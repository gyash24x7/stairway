import { Module, OnModuleInit } from "@nestjs/common";
import { GamesController } from "./controllers";
import { PrismaModule, RealtimeModule, RealtimeService } from "@s2h/core";
import { AuthModule } from "@auth/core";
import { commandHandlers } from "./commands";
import { queryHandlers } from "./queries";
import { CqrsModule } from "@nestjs/cqrs";
import { eventHandlers } from "./events";

@Module( {
	imports: [ PrismaModule, AuthModule, CqrsModule, RealtimeModule ],
	controllers: [ GamesController ],
	providers: [ ...commandHandlers, ...queryHandlers, ...eventHandlers ]
} )
export class LiteratureModule implements OnModuleInit {

	constructor( private readonly realtimeService: RealtimeService ) {}

	onModuleInit() {
		this.realtimeService.registerNamespace( "literature" );
	}
}