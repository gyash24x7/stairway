import type { ExpressHandler, IUser } from "@s2h/utils";

export default function getLoggedInUser(): ExpressHandler {
	return async function ( _req, res ) {
		const user = res.locals[ "user" ] as IUser;
		return res.send( user );
	};
}