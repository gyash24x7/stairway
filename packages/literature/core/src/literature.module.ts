import { AuthMiddleware, TrpcModule, type User } from "@common/core";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import {
	AddBotsCommandHandler,
	AskCardCommandHandler,
	CallSetCommandHandler,
	CreateGameCommandHandler,
	CreateTeamsCommandHandler,
	JoinGameCommandHandler,
	StartGameCommandHandler,
	TransferTurnCommandHandler
} from "./commands";
import {
	GameCompletedEventHandler,
	GameStartedEventHandler,
	HandsUpdatedEventHandler,
	MoveCreatedEventHandler,
	PlayerJoinedEventHandler,
	TeamsCreatedEventHandler,
	TurnUpdatedEventHandler
} from "./events";
import { CardsDataQueryHandler, GameDataQueryHandler, PlayerDataQueryHandler } from "./queries";
import { DatabaseService, GatewayService, MiddlewareService, RouterService } from "./services";
import { Constants } from "./utils";

const commandHandlers = [
	AddBotsCommandHandler,
	AskCardCommandHandler,
	CallSetCommandHandler,
	CreateGameCommandHandler,
	CreateTeamsCommandHandler,
	JoinGameCommandHandler,
	StartGameCommandHandler,
	TransferTurnCommandHandler
];

const services = [ GatewayService, MiddlewareService, RouterService, DatabaseService ];

const queryHandlers = [ GameDataQueryHandler, CardsDataQueryHandler, PlayerDataQueryHandler ];

const eventHandlers = [
	GameCompletedEventHandler,
	GameStartedEventHandler,
	HandsUpdatedEventHandler,
	MoveCreatedEventHandler,
	PlayerJoinedEventHandler,
	TeamsCreatedEventHandler,
	TurnUpdatedEventHandler
];

@Module( {
	imports: [ TrpcModule, CqrsModule ],
	providers: [ ...services, ...commandHandlers, ...queryHandlers, ...eventHandlers ]
} )
export class LiteratureModule implements NestModule {

	constructor( private readonly router: RouterService ) {}

	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( AuthMiddleware, this.trpcMiddleware() ).forRoutes( "/literature" );
	}

	trpcMiddleware() {
		return createExpressMiddleware( {
			router: this.router.router(),
			createContext: ( { res } ) => {
				const authUser: User = res.locals[ Constants.AUTH_USER ];
				return { authUser };
			}
		} );
	}
}

export type Router = ReturnType<RouterService["router"]>;
