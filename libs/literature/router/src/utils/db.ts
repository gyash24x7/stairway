import { Db as BaseDb, logger, Publisher } from "@s2h/utils";
import { ILiteratureGame } from "@s2h/literature/utils";
import { Connection, RTable } from "rethinkdb-ts";

export type Db = BaseDb & { literature: () => RTable<ILiteratureGame> }

export function initializeGameSubscription( publisher: Publisher<ILiteratureGame>, connection: Connection, db: Db ) {
	db.literature().changes().run( connection )
		.then( async cursor => {
			logger.debug( "Database Feed Initialised!" );

			const change = await cursor.next();
			logger.debug( "Event Received: %o", change );

			if ( !!change.new_val ) {
				publisher.publish( change.new_val );
			} else {
				logger.warn( "New Value not present!" );
			}
		} )
		.catch( e => {
			logger.error( "Error creating database feed!" );
			logger.error( e );
		} );
}