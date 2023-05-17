import type { ExpressHandler } from "@s2h/utils";

export default function getLoggedInUser(): ExpressHandler {
	return async function ( _req, res ) {
		const user = res.locals[ "user" ] as User;
		return res.send( user );
	};
}