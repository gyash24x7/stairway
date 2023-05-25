import type { ExpressHandler, IUser } from "@s2h/utils";

export function handleGetLoggedInUser(): ExpressHandler {
	return async ( _req, res ) => {
		const user = res.locals[ "user" ] as IUser;
		return res.send( user );
	};
}