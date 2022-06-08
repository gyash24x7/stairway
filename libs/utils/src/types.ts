import type { LitGame, LitMove, LitPlayer, LitTeam, Prisma, PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type { Namespace } from "socket.io";
import type { MiddlewareFunction } from "@trpc/server/dist/declarations/src/internals/middlewares";
import type { EnhancedLitGame } from "./literature";

export class LitGamePublisher {
	private readonly namespace: Namespace;

	constructor( namespace: Namespace ) {
		this.namespace = namespace;
	}

	publish( gameData: EnhancedLitGame ) {
		this.namespace.emit( gameData.id, gameData );
	}
}

export type TrpcContext = {
	req?: Request;
	res?: Response;
	prisma: PrismaClient;
	litGamePublisher: LitGamePublisher;
}

export type TrpcMiddleware = MiddlewareFunction<TrpcContext, TrpcContext, any>

export type TrpcResolverOptions<I = any> = {
	input: I;
	ctx: TrpcContext;
}

export type TrpcResolver<I = any, R = any> = ( options: TrpcResolverOptions<I> ) => R | Promise<R>

export type LitResolver<I = unknown> = TrpcResolver<I, EnhancedLitGame>;

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

export type LitMoveDataWithoutDescription = Omit<Prisma.LitMoveUncheckedCreateInput, "description">;

export type LitGameData = LitGame & { players: LitPlayer[] } & { moves: LitMove[] } & { teams: LitTeam[] }