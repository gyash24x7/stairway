import { TrpcModule } from "@backend/utils";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { AuthRepository } from "./auth.repository.ts";
import { AuthRouter } from "./auth.router.ts";
import { CreateUserCommandHandler, LoginCommandHandler, VerifyUserCommandHandler } from "./commands";

const commandHandlers = [ CreateUserCommandHandler, VerifyUserCommandHandler, LoginCommandHandler ];

@Module( {
	imports: [ TrpcModule, CqrsModule ],
	providers: [ AuthRepository, AuthRouter, ...commandHandlers ]
} )
export class AuthModule implements NestModule {

	constructor( private readonly router: AuthRouter ) {}

	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( this.trpcMiddleware() ).forRoutes( "/auth" );
	}

	trpcMiddleware() {
		return createExpressMiddleware( {
			router: this.router.router(),
			createContext: this.router.createContext()
		} );
	}
}

export type Router = ReturnType<AuthRouter["router"]>;
