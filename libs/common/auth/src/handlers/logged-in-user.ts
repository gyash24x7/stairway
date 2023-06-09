import type { ExpressHandler, IUser } from "libs/utils/src";
import { logger } from "libs/utils/src";

export function handleGetLoggedInUser(): ExpressHandler {
	return async ( _req, res ) => {
		logger.debug( ">> handleGetLoggedInUser()" );
		const user = res.locals[ "user" ] as IUser;
		return res.send( user );
	};
}