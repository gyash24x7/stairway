import type { ExpressHandler } from "libs/utils/src";
import { logger } from "libs/utils/src";
import { accessTokenCookieOptions, refreshTokenCookieOptions } from "../utils";

export function handleLogout(): ExpressHandler {
	return async ( _req, res ) => {
		logger.debug( ">> handleLogout()" );
		res.clearCookie( "accessToken", accessTokenCookieOptions );
		res.clearCookie( "refreshToken", refreshTokenCookieOptions );
		return res.send( {} );
	};
}