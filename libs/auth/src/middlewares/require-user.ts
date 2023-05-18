import type { ExpressMiddleware, IUser } from "@s2h/utils";
import { Connection, RDatabase } from "rethinkdb-ts";

export function requireUser( db: RDatabase, connection: Connection ): ExpressMiddleware {
	return async function ( _req, res, next ) {
		if ( !res.locals[ "userId" ] ) {
			return res.sendStatus( 403 );
		} else {
			const user = await db.table<IUser>( "users" ).get( res.locals[ "userId" ] ).run( connection );
			if ( !user ) {
				return res.sendStatus( 403 );
			}
			res.locals[ "user" ] = user;
			return next();
		}
	};
}