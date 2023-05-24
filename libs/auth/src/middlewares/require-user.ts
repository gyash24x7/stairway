import type { ExpressMiddleware } from "@s2h/utils";
import { db } from "@s2h/utils";
import { Connection } from "rethinkdb-ts";

export function requireUser( connection: Connection ): ExpressMiddleware {
	return async function ( _req, res, next ) {
		if ( !res.locals[ "userId" ] ) {
			return res.sendStatus( 403 );
		} else {
			const user = await db.users().get( res.locals[ "userId" ] ).run( connection );
			if ( !user ) {
				return res.sendStatus( 403 );
			}
			res.locals[ "user" ] = user;
			return next();
		}
	};
}