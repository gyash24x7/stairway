import type { ExpressHandler } from "@s2h/utils";
import type { User } from "@prisma/client";

export default function getLoggedInUser(): ExpressHandler {
	return async function ( _req, res ) {
		const user = res.locals[ "user" ] as User;
		return res.send( user );
	};
}