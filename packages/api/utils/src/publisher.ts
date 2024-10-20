import { format } from "node:util";
import * as redis from "redis";
import { createLogger } from "./logger.ts";

const logger = createLogger( "Publisher" );

const publisher = redis.createClient( {
	url: process.env[ "REDIS_URL" ] ?? "redis://localhost:6379"
} );
await publisher.connect();

export function publishLiteraturePlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
	const eventKey = `${ playerId }:${ event }`;
	publisher.publish( "literature-event", JSON.stringify( { gameId, playerId, event, data } ) ).then( () => {
		logger.debug( format( "Published Literature Direct Message:", eventKey ) );
	} );
}

export function publishLiteratureGameEvent( gameId: string, event: string, data: any ) {
	const eventKey = `${ gameId }:${ event }`;

	publisher.publish( "literature-event", JSON.stringify( { gameId, event, data } ) ).then( () => {
		logger.debug( format( "Published Literature Room Message:", eventKey ) );
	} );
}

export function publishCallbreakPlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
	const eventKey = `${ playerId }:${ event }`;
	publisher.publish( "literature-event", JSON.stringify( { gameId, playerId, event, data } ) ).then( () => {
		logger.debug( format( "Published Literature Direct Message:", eventKey ) );
	} );
}

export function publishCallbreakGameEvent( gameId: string, event: string, data: any ) {
	const eventKey = `${ gameId }:${ event }`;

	publisher.publish( "literature-event", JSON.stringify( { gameId, event, data } ) ).then( () => {
		logger.debug( format( "Published Literature Room Message:", eventKey ) );
	} );
}