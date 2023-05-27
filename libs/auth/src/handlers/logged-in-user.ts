import type { ExpressHandler, IUser } from "@s2h/utils";
import { logger } from "@s2h/utils";

export function handleGetLoggedInUser(): ExpressHandler {
	return async ( _req, res ) => {
		logger.debug( ">> handleGetLoggedInUser()" );
		const user = res.locals[ "user" ] as IUser;
		return res.send( user );
	};
}