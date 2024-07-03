import { TrpcModule } from "@backend/utils";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import {
	AddBotsCommandHandler,
	AskCardCommandHandler,
	CallSetCommandHandler,
	CreateGameCommandHandler,
	CreateTeamsCommandHandler,
	ExecuteBotMoveCommandHandler,
	JoinGameCommandHandler,
	StartGameCommandHandler,
	TransferTurnCommandHandler,
	UpdateCardLocationsCommandHandler
} from "./commands";
import {
	CardLocationsUpdatedEventHandler,
	GameCompletedEventHandler,
	HandsUpdatedEventHandler,
	MoveCreatedEventHandler,
	PlayerJoinedEventHandler,
	TeamsCreatedEventHandler,
	TurnUpdatedEventHandler
} from "./events";
import { LiteratureGateway } from "./literature.gateway.ts";
import { LiteratureRepository } from "./literature.repository.ts";
import { LiteratureRouter } from "./literature.router.ts";
import { CardLocationsDataQueryHandler, CardsDataQueryHandler, GameDataQueryHandler } from "./queries";

const commandHandlers = [
	AddBotsCommandHandler,
	AskCardCommandHandler,
	CallSetCommandHandler,
	CreateGameCommandHandler,
	CreateTeamsCommandHandler,
	JoinGameCommandHandler,
	StartGameCommandHandler,
	TransferTurnCommandHandler,
	UpdateCardLocationsCommandHandler,
	ExecuteBotMoveCommandHandler
];

const services = [ LiteratureGateway, LiteratureRouter, LiteratureRepository ];

const queryHandlers = [ GameDataQueryHandler, CardsDataQueryHandler, CardLocationsDataQueryHandler ];

const eventHandlers = [
	GameCompletedEventHandler,
	HandsUpdatedEventHandler,
	MoveCreatedEventHandler,
	PlayerJoinedEventHandler,
	TeamsCreatedEventHandler,
	TurnUpdatedEventHandler,
	CardLocationsUpdatedEventHandler
];

@Module( {
	imports: [ TrpcModule, CqrsModule ],
	providers: [ ...services, ...commandHandlers, ...queryHandlers, ...eventHandlers ]
} )
export class LiteratureModule implements NestModule {

	constructor( private readonly router: LiteratureRouter ) {}

	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( this.trpcMiddleware() ).forRoutes( "/literature" );
	}

	trpcMiddleware() {
		return createExpressMiddleware( {
			router: this.router.router(),
			createContext: this.router.createContext()
		} );
	}
}

export type Router = ReturnType<LiteratureRouter["router"]>;
export type * from "./literature.types.ts";