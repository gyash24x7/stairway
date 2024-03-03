import { AuthMiddleware, TrpcModule, type User } from "@common/core";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { CreateGameCommandHandler, MakeGuessCommandHandler } from "./commands";
import { GameDataQueryHandler } from "./queries";
import { DatabaseService, MiddlewareService, RouterService } from "./services";
import { Constants } from "./utils";

const commandHandlers = [ CreateGameCommandHandler, MakeGuessCommandHandler ];
const services = [ MiddlewareService, RouterService, DatabaseService ];
const queryHandlers = [ GameDataQueryHandler ];

@Module( {
	imports: [ TrpcModule, CqrsModule ],
	providers: [ ...services, ...commandHandlers, ...queryHandlers ]
} )
export class WordleModule implements NestModule {

	constructor( private readonly router: RouterService ) {}

	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( AuthMiddleware, this.trpcMiddleware() ).forRoutes( "/wordle" );
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
