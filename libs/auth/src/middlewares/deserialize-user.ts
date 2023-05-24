import type { ExpressMiddleware, UsersR } from "@s2h/utils";
import { accessTokenCookieOptions, reIssueAccessToken, verifyJwt } from "../utils";
import { Connection } from "rethinkdb-ts";

export function deserializeUser( r: UsersR, connection: Connection ): ExpressMiddleware {
	return async function ( req, res, next ) {
		const authHeader = req.headers.authorization || "";
		const refreshHeader = req.headers[ "x-refresh" ] || "";

		const accessToken: string = req.cookies[ "accessToken" ] || authHeader.replace( /^Bearer\s/, "" );
		const refreshToken: string = req.cookies[ "refreshToken" ] || refreshHeader;

		if ( !accessToken ) {
			return next();
		}

		const { subject, expired } = await verifyJwt( accessToken );

		if ( subject ) {
			res.locals[ "userId" ] = subject;
			return next();
		}

		if ( expired && !!refreshToken ) {
			const newAccessToken = await reIssueAccessToken( refreshToken, r, connection );

			if ( !!newAccessToken ) {
				res.cookie( "accessToken", newAccessToken, accessTokenCookieOptions );
				const { subject } = await verifyJwt( newAccessToken );
				res.locals[ "userId" ] = subject;
			}

			return next();
		}

		return next();
	};
}