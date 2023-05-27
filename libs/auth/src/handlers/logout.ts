import type { ExpressHandler } from "@s2h/utils";
import { logger } from "@s2h/utils";
import { accessTokenCookieOptions, refreshTokenCookieOptions } from "../utils";

export function handleLogout(): ExpressHandler {
	return async ( _req, res ) => {
		logger.debug( ">> handleLogout()" );
		res.clearCookie( "accessToken", accessTokenCookieOptions );
		res.clearCookie( "refreshToken", refreshTokenCookieOptions );
		return res.send( {} );
	};
}