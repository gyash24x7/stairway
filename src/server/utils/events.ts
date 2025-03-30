import { createLogger } from "@/server/utils/logger";
import { createClient } from "redis";

export type GenericEvent = {
	gameId: string;
	playerId?: string;
	event: string;
	data: any;
}

const logger = createLogger( "Events" );

const redisClient = createClient( {
	url: process.env.REDIS_URL
} );

export async function connectRedis() {
	logger.info( "Connecting to redis..." );
	await redisClient.connect();
	redisClient.on( "error", ( e ) => {
		logger.error( "Error in redis: %s", e );
	} );
}

export async function emitGameEvent( game: "literature" | "callbreak", event: GenericEvent ) {
	if ( !redisClient.isOpen ) {
		await connectRedis();
	}

	redisClient.publish( game, JSON.stringify( event ) ).then( () => {
		logger.info( "Published %s Game Event %s", game, event );
	} );
}

export async function subscribeToGameEvents(
	game: "literature" | "callbreak",
	handler: ( event: GenericEvent ) => void
) {
	if ( !redisClient.isOpen ) {
		await connectRedis();
	}

	logger.info( "Subscribing to %s Game Events", game );
	await redisClient.subscribe( game, ( payload ) => {
		const event = JSON.parse( payload ) as GenericEvent;
		handler( event );
	} );
}