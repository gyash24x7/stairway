import { TrpcModule } from "@backend/utils";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { CreateGameCommandHandler, MakeGuessCommandHandler } from "./commands";
import { GameDataQueryHandler } from "./queries";
import { WordleRepository } from "./wordle.repository.ts";
import { WordleRouter } from "./wordle.router.ts";
import type { games } from "./wordle.schema.ts";


const commandHandlers = [ CreateGameCommandHandler, MakeGuessCommandHandler ];
const queryHandlers = [ GameDataQueryHandler ];

@Module( {
	imports: [ TrpcModule, CqrsModule ],
	providers: [ WordleRouter, WordleRepository, ...commandHandlers, ...queryHandlers ]
} )
export class WordleModule implements NestModule {

	constructor( private readonly router: WordleRouter ) {}

	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( this.trpcMiddleware() ).forRoutes( "/wordle" );
	}

	trpcMiddleware() {
		return createExpressMiddleware( {
			router: this.router.router(),
			createContext: this.router.createContext()
		} );
	}
}

export type Router = ReturnType<WordleRouter["router"]>;
export type Game = typeof games.$inferSelect;
