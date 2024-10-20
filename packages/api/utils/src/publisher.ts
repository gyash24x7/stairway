import { format } from "node:util";
import * as redis from "redis";
import { createLogger } from "./logger.ts";

const logger = createLogger( "Publisher" );

const publisher = redis.createClient( {
	url: process.env[ "REDIS_URL" ] ?? "redis://localhost:6379"
} );

function publishEvent( event: string, payload: string ) {
	publisher.connect().then( () => {
		publisher.publish( event, payload ).then( () => {
			logger.debug( format( "Published Event: %s Payload: %s", event, payload ) );
		} );
	} );
}


export function publishLiteraturePlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
	publishEvent( "literature-event", JSON.stringify( { gameId, playerId, event, data } ) );
}

export function publishLiteratureGameEvent( gameId: string, event: string, data: any ) {
	publishEvent( "literature-event", JSON.stringify( { gameId, event, data } ) );
}

export function publishCallbreakPlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
	publishEvent( "callbreak-event", JSON.stringify( { gameId, playerId, event, data } ) );
}

export function publishCallbreakGameEvent( gameId: string, event: string, data: any ) {
	publishEvent( "callbreak-event", JSON.stringify( { gameId, event, data } ) );
}
