import { green, yellow } from "colorette";
import type { NextFunction, Request, Response } from "express";
import { LoggerFactory } from "./logger.factory";

export function loggerMiddleware() {
	const logger = LoggerFactory.getLogger();
	return ( req: Request, _res: Response, next: NextFunction ) => {
		logger.info( `${ green( req.method.toUpperCase() ) } ${ yellow( req.path ) }` );
		next();
	};
}
