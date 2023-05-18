import type { NextFunction, Request, Response } from "express";
import type { Namespace } from "socket.io";
import { Connection, RTable } from "rethinkdb-ts";

export interface IUser {
	id: string;
	name: string;
	email: string;
	salt: string;
	avatar: string;
}

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
	loggedInUser?: IUser;
	usersTable: RTable<IUser>;
	connection: Connection;
}

export type TrpcMiddleware<C = TrpcContext, R = any> = ( opts: {
	rawInput: unknown,
	ctx: C,
	next: ( opts: { ctx: C } ) => Promise<R>
} ) => Promise<R>

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