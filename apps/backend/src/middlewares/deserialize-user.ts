import { accessTokenCookieOptions, reIssueAccessToken, verifyJwt } from "../utils/token";
import type { ExpressMiddleware } from "@s2h/utils";
import type { PrismaClient } from "@prisma/client";

function deserializeUser( prisma: PrismaClient ): ExpressMiddleware {
	return async function ( req, res, next ) {
		const authHeader = req.headers.authorization || "";
		const refreshHeader = req.headers[ "x-refresh" ] || "";

		const accessToken: string = req.cookies[ "accessToken" ] || authHeader.replace( /^Bearer\s/, "" );
		const refreshToken: string = req.cookies[ "refreshToken" ] || refreshHeader;

		if ( !accessToken ) {
			return next();
		}

		const { subject, expired } = verifyJwt( accessToken );

		if ( subject ) {
			res.locals.userId = subject;
			return next();
		}

		if ( expired && !!refreshToken ) {
			const newAccessToken = await reIssueAccessToken( refreshToken, prisma );

			if ( !!newAccessToken ) {
				res.cookie( "accessToken", newAccessToken, accessTokenCookieOptions );
				const { subject } = verifyJwt( newAccessToken );
				res.locals.userId = subject;
			}

			return next();
		}

		return next();
	};
}

export default deserializeUser;