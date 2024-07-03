import { Injectable } from "@nestjs/common";
import { initTRPC, TRPCError } from "@trpc/server";
import type { NodeHTTPCreateContextFnOptions } from "@trpc/server/adapters/node-http";
import type { MiddlewareFunction } from "@trpc/server/unstable-core-do-not-import";
import type { Request, Response } from "express";
import { verify } from "jsonwebtoken";

export type MiddlewareFn<CtxIn, CtxOut> = MiddlewareFunction<CtxIn, any, CtxIn, CtxOut, any>;

export type UserAuthInfo = {
	id: string;
	name: string;
	avatar: string;
	verified: boolean;
};

export type BaseContext = {
	authInfo?: UserAuthInfo;
}

export type AuthContext = {
	authInfo: UserAuthInfo;
}

@Injectable()
export class TrpcService {
	private t = initTRPC.context<BaseContext>().create();

	get router() {
		return this.t.router;
	}

	get procedure() {
		return this.t.procedure;
	}

	get authenticatedProcedure() {
		return this.procedure.use( this.authMiddleware() );
	}

	async createContextFn( { req }: NodeHTTPCreateContextFnOptions<Request, Response> ): Promise<BaseContext> {
		const authHeader = req.headers[ "authorization" ];
		if ( authHeader ) {
			const token = authHeader.split( " " )[ 1 ];
			try {
				const authInfo = verify( token, process.env[ "JWT_SECRET" ]! ) as UserAuthInfo;
				return { authInfo };
			} catch ( e ) {
				return {};
			}
		}

		return {};
	};

	private authMiddleware(): MiddlewareFn<BaseContext, AuthContext> {
		return async ( { ctx, next } ) => {
			if ( !ctx.authInfo ) {
				throw new TRPCError( { code: "UNAUTHORIZED" } );
			}

			return next( { ctx } );
		};
	}
}
