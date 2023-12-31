import type { NextFunction, Request, Response } from "express";

export interface Type<T = any> extends Function {
	new( ...args: any[] ): T;
}

export interface Middleware {
	use: ( req: Request, res: Response, next: NextFunction ) => Promise<any>;
}

export class HttpException extends Error {
	private readonly statusCode: number;

	constructor( statusCode: number, message: string = "" ) {
		super( message );
		this.statusCode = statusCode;
	}

	getStatus() {
		return this.statusCode;
	}
}