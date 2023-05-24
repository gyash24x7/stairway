import type { ExpressMiddleware, UsersR } from "@s2h/utils";
import { Connection } from "rethinkdb-ts";

export function requireUser( r: UsersR, connection: Connection ): ExpressMiddleware {
	return async function ( _req, res, next ) {
		if ( !res.locals[ "userId" ] ) {
			return res.sendStatus( 403 );
		} else {
			const user = await r.users().get( res.locals[ "userId" ] ).run( connection );
			if ( !user ) {
				return res.sendStatus( 403 );
			}
			res.locals[ "user" ] = user;
			return next();
		}
	};
}