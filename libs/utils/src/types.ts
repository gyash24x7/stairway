import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type { MiddlewareFunction } from "@trpc/server/dist/declarations/src/internals/middlewares";
import type { Namespace } from "socket.io";

export class Publisher<T extends { id: string }> {
	private readonly namespace: Namespace;

	constructor( namespace: Namespace ) {
		this.namespace = namespace;
	}

	publish( gameData: T ) {
		this.namespace.emit( gameData.id, gameData );
	}
}

export type TrpcContext = {
	req?: Request;
	res?: Response;
	prisma: PrismaClient;
}

export type TrpcMiddleware = MiddlewareFunction<TrpcContext, TrpcContext, any>

export type TrpcResolverOptions<I = any, C = TrpcContext> = { input: I; ctx: C; }

export type TrpcResolver<I = any, R = any, C = TrpcContext> = ( options: TrpcResolverOptions<I, C> ) => R | Promise<R>

export type ExpressMiddleware = ( req: Request, res: Response, next: NextFunction ) => any | Promise<any>

export type ExpressHandler = ( req: Request, res: Response ) => any | Promise<any>

export type GoogleTokenResult = {
	access_token: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	id_token: string;
}

export type GoogleUserResult = {
	id: string;
	email: string;
	verified_email: boolean;
	name: string;
	given_name: string;
	family_name: string;
	picture: string;
	locale: string;
}