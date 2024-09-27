import { AuthService } from "@auth/api";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { OgmaModule } from "@ogma/nestjs-module";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { NextFunction, Request, Response } from "express";
import { WordleMutations } from "./wordle.mutations.ts";
import { WordlePrisma } from "./wordle.prisma.ts";
import { WordleQueries } from "./wordle.queries.ts";
import { WordleRouter } from "./wordle.router.ts";

const providers = [ WordleRouter, WordlePrisma, WordleQueries, WordleMutations ];

@Module( { imports: [ OgmaModule.forFeatures( providers ) ], providers } )
export class WordleModule implements NestModule {

	constructor(
		private readonly router: WordleRouter,
		private readonly authService: AuthService
	) {}

	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( this.authMiddleware(), this.trpcMiddleware() ).forRoutes( "/wordle" );
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