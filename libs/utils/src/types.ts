import type { PrismaClient, User } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type { Namespace } from "socket.io";
import type { MiddlewareResult } from "@trpc/server/src/internals/middlewares";

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
	loggedInUser?: User;
	prisma: PrismaClient;
}

export type TrpcMiddlewareOptions<C = TrpcContext> = {
	rawInput: unknown,
	ctx: C,
	next: {
		(): Promise<MiddlewareResult<C>>;
		<T>( opts: { ctx: T } ): Promise<MiddlewareResult<T>>;
	}
}

export type TrpcResolverOptions<I = any, C = TrpcContext> = { input: I; ctx: C; }

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