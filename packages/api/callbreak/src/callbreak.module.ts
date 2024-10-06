import { AuthService } from "@auth/api";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { OgmaModule } from "@ogma/nestjs-module";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { NextFunction, Request, Response } from "express";
import { CallBreakBotService } from "./callbreak.bot.service.ts";
import { CallBreakGateway } from "./callbreak.gateway.ts";
import { CallBreakMutations } from "./callbreak.mutations.ts";
import { CallBreakPrisma } from "./callbreak.prisma.ts";
import { CallBreakQueries } from "./callbreak.queries.ts";
import { CallBreakRouter } from "./callbreak.router.ts";
import { CallBreakValidators } from "./callbreak.validators.ts";

const providers = [
	CallBreakPrisma,
	CallBreakBotService,
	CallBreakQueries,
	CallBreakMutations,
	CallBreakValidators,
	CallBreakGateway,
	CallBreakRouter
];

@Module( { imports: [ OgmaModule.forFeatures( providers ) ], providers } )
export class CallBreakModule implements NestModule {

	constructor(
		private readonly router: CallBreakRouter,
		private readonly authService: AuthService
	) {}

	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( this.authMiddleware(), this.trpcMiddleware() ).forRoutes( "/callbreak" );
	}

	authMiddleware() {
		return async ( req: Request, res: Response, next: NextFunction ) => {
			const { user } = await this.authService.validateRequest( req, res );
			res.locals.authInfo = user;
			return next();
		};
	}

	trpcMiddleware() {
		return createExpressMiddleware( {
			router: this.router.router(),
			createContext: async ( { res } ) => ( { authInfo: res.locals.authInfo } )
		} );
	}
}