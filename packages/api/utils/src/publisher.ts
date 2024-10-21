import { format } from "node:util";
import * as redis from "redis";
import { createLogger } from "./logger.ts";

const logger = createLogger( "Publisher" );
const redisHost = process.env[ "REDIS_HOST" ] ?? "localhost";
const redisPort = parseInt( process.env[ "REDIS_PORT" ] ?? "6379" );

let publisher = redis.createClient( {
	url: `redis://${ redisHost }:${ redisPort }`
} );

async function publishEvent( event: string, payload: string ) {
	if ( !publisher.isOpen ) {
		await publisher.connect();
	}

	await publisher.publish( event, payload ).then( () => {
		logger.debug( format( "Published Event: %s Payload: %s", event, payload ) );
	} );
}


export function publishLiteraturePlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
	publishEvent( "literature-event", JSON.stringify( { gameId, playerId, event, data } ) ).then();
}

export function publishLiteratureGameEvent( gameId: string, event: string, data: any ) {
	publishEvent( "literature-event", JSON.stringify( { gameId, event, data } ) ).then();
}

export function publishCallbreakPlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
	publishEvent( "callbreak-event", JSON.stringify( { gameId, playerId, event, data } ) ).then();
}

export function publishCallbreakGameEvent( gameId: string, event: string, data: any ) {
	publishEvent( "callbreak-event", JSON.stringify( { gameId, event, data } ) ).then();
}