import { AuthService } from "@auth/api";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { OgmaModule } from "@ogma/nestjs-module";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { NextFunction, Request, Response } from "express";
import { LiteratureBotService } from "./literature.bot.service.ts";
import { LiteratureGateway } from "./literature.gateway.ts";
import { LiteratureMutations } from "./literature.mutations.ts";
import { LiteraturePrisma } from "./literature.prisma.ts";
import { LiteratureQueries } from "./literature.queries.ts";
import { LiteratureRouter } from "./literature.router.ts";
import { LiteratureValidators } from "./literature.validators.ts";

const providers = [
	LiteraturePrisma,
	LiteratureQueries,
	LiteratureMutations,
	LiteratureValidators,
	LiteratureGateway,
	LiteratureBotService,
	LiteratureRouter
];

@Module( { imports: [ OgmaModule.forFeatures( providers ) ], providers } )
export class LiteratureModule implements NestModule {

	constructor(
		private readonly router: LiteratureRouter,
		private readonly authService: AuthService
	) {}

	configure( consumer: MiddlewareConsumer ) {
		consumer.apply( this.authMiddleware(), this.trpcMiddleware() ).forRoutes( "/literature" );
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