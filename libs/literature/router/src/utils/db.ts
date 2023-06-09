import { Db as BaseDb, logger, Publisher } from "@s2h/utils";
import { ILiteratureGame, ILiteratureGameHand, ILiteratureMove } from "@s2h/literature/utils";
import { Collection } from "mongodb";

export type Db = BaseDb & {
	games: () => Collection<ILiteratureGame>,
	moves: () => Collection<ILiteratureMove<any>>,
	hands: () => Collection<ILiteratureGameHand>
}

export function initializeGameSubscription( publisher: Publisher<ILiteratureGame>, db: Db ) {
	const stream = db.games().watch();

	stream.on( "change", async change => {
		logger.debug( "Event Received: %o", change );
		if ( !!change._id ) {
			const game = await db.games().findOne( { _id: change._id } );
			publisher.publish( game! );
		} else {
			logger.warn( "New Value not present!" );
		}
	} );
}