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
	await redisClient.connect();
}

export function emitGameEvent( game: "literature" | "callbreak", event: GenericEvent ) {
	redisClient.publish( game, JSON.stringify( event ) ).then( () => {
		logger.info( "Published %s Game Event %s", game, event );
	} );
}

export async function subscribeToGameEvents(
	game: "literature" | "callbreak",
	handler: ( event: GenericEvent ) => void
) {
	logger.info( "Subscribing to %s Game Events", game );
	await redisClient.subscribe( game, ( payload ) => {
		const event = JSON.parse( payload ) as GenericEvent;
		handler( event );
	} );
}