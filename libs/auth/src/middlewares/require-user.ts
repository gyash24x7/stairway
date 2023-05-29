import type { Db, ExpressMiddleware } from "@s2h/utils";
import { logger } from "@s2h/utils";
import { Connection } from "rethinkdb-ts";

export function requireUser( connection: Connection, db: Db ): ExpressMiddleware {
	return async ( _req, res, next ) => {
		logger.debug( ">> requireUser()" );
		logger.debug( "UserId: %s", res.locals[ "userId" ] );

		if ( !res.locals[ "userId" ] ) {
			logger.warn( "UserId not present!" );
			return res.sendStatus( 403 );
		} else {
			const user = await db.users().get( res.locals[ "userId" ] ).run( connection );
			if ( !user ) {
				logger.warn( "Unknown User!" );
				return res.sendStatus( 403 );
			}
			res.locals[ "user" ] = user;

			logger.debug( "User Present!" );
			return next();
		}
	};
}