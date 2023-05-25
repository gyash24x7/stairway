import type { ExpressHandler } from "@s2h/utils";
import { accessTokenCookieOptions, refreshTokenCookieOptions } from "../utils/token";

export function handleLogout(): ExpressHandler {
	return async ( _req, res ) => {
		res.clearCookie( "accessToken", accessTokenCookieOptions );
		res.clearCookie( "refreshToken", refreshTokenCookieOptions );
		return res.send( {} );
	};
}