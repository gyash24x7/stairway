import { clerkClient } from "@clerk/clerk-sdk-node";
import { ForbiddenException, Injectable, type NestMiddleware, UnauthorizedException } from "@nestjs/common";
import Cookies from "cookies";
import type { NextFunction, Request, Response } from "express";
import { type JwtPayload, verify } from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";
import process from "process";
import { LoggerFactory } from "../logger";

@Injectable()
export class AuthMiddleware implements NestMiddleware {

	private readonly logger = LoggerFactory.getLogger( AuthMiddleware );

	private readonly jwksClient = new JwksClient( {
		jwksUri: process.env[ "JWKS_URI" ]!
	} );

	async use( req: Request, res: Response, next: NextFunction ) {
		const cookies = new Cookies( req, res );
		const token = cookies.get( "__session" );

		if ( !token ) {
			this.logger.debug( "Not Token Found!" );
			throw new UnauthorizedException();
		}

		const key = await this.jwksClient.getSigningKey();
		const payload = verify( token, key.getPublicKey() ) as JwtPayload;
		if ( !payload.sub ) {
			this.logger.debug( "Subject Not Found!" );
			throw new ForbiddenException();
		}

		const user = await clerkClient.users.getUser( payload.sub );
		if ( !user ) {
			this.logger.debug( "No User Found!" );
			throw new ForbiddenException();
		}

		res.locals[ "authUser" ] = { id: user.id, name: user.firstName + " " + user.lastName };
		return next();
	};
}