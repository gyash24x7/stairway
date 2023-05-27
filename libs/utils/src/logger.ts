import { constantCase } from "change-case";
import { green, yellow } from "colorette";
import type { NextFunction, Request, Response } from "express";
import process from "node:process";
import { Ogma } from "@ogma/logger";
import { format } from "node:util";


class Logger {
	private readonly ogma = new Ogma( {
		logLevel: "ALL",
		color: process.env[ "NODE_ENV" ] !== "production",
		json: process.env[ "NODE_ENV" ] === "production"
	} );

	debug( message: string, ...params: any[] ) {
		this.ogma.debug( format( message, ...params ) );
	}

	error( message: string, ...params: any[] ) {
		this.ogma.error( format( message, ...params ) );
	}

	log( message: string, ...params: any[] ) {
		this.ogma.info( format( message, ...params ) );
	}

	verbose( message: string, ...params: any[] ) {
		this.ogma.verbose( format( message, ...params ) );
	}

	warn( message: string, ...params: any[] ) {
		this.ogma.warn( format( message, ...params ) );
	}

	info( message: string, ...params: any[] ) {
		this.ogma.info( format( message, ...params ) );
	}

	trace( message: string, ...params: any[] ) {
		this.ogma.verbose( format( message, ...params ) );
	}
}

export const logger = new Logger();

export function loggerMiddleware() {
	return ( req: Request, _res: Response, next: NextFunction ) => {
		logger.info( `${ green( constantCase( req.method ) ) } ${ yellow( req.path ) }` );
		next();
	};
}
