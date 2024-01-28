import { AuthMiddleware, TrpcModule, type User } from "@common/core";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { CreateGameCommandHandler, MakeGuessCommandHandler } from "./commands";
import { GameDataQueryHandler } from "./queries";
import { Constants, WordleMiddlewares, WordleRouter, WordleService } from "./utils";

const commandHandlers = [ CreateGameCommandHandler, MakeGuessCommandHandler ];
const utilities = [ WordleMiddlewares, WordleRouter, WordleService ];
const queryHandlers = [ GameDataQueryHandler ];

@Module( {
	imports: [ TrpcModule, CqrsModule ],
	providers: [ ...utilities, ...commandHandlers, ...queryHandlers ]
} )
export class WordleModule implements NestModule {

	constructor( private readonly router: WordleRouter ) {}

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

export type Router = ReturnType<WordleRouter["router"]>;
