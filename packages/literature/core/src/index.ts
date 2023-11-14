import { AuthModule } from "@auth/core";
import { Module, OnModuleInit } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { PrismaModule, RealtimeModule, RealtimeService } from "@s2h/core";
import { commandHandlers } from "./commands";
import { GamesController } from "./controllers";
import { eventHandlers } from "./events";
import { queryHandlers } from "./queries";
import { transformers } from "./transformers";
import { validators } from "./validators";

@Module( {
	imports: [ PrismaModule, AuthModule, CqrsModule, RealtimeModule ],
	controllers: [ GamesController ],
	providers: [ ...commandHandlers, ...queryHandlers, ...eventHandlers, ...validators, ...transformers ]
} )
export class LiteratureModule implements OnModuleInit {

	constructor( private readonly realtimeService: RealtimeService ) {}

	onModuleInit() {
		this.realtimeService.registerNamespace( "literature" );
	}
}