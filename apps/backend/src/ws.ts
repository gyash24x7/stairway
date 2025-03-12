import { auth } from "@auth/api";
import { createLogger, subscribeToGameEvents } from "@stairway/utils";
import type { Server } from "bun";
import crossws from "crossws/adapters/bun";
import { createError } from "h3";

const logger = createLogger( "WebSocket" );

const ws = crossws( {
	hooks: {
		open( peer ) {
			logger.debug( "Client Connected! %s", peer.id );
		},

		message( peer, message ) {
			logger.debug( "Message Received! %s", peer.id );
			const { game, gameId, playerId } = message.json<{ game: string, gameId: string, playerId: string }>();
			peer.subscribe( `${ game }-${ gameId }-${ playerId }` );
			peer.subscribe( `${ game }-${ gameId }` );
		},

		close( peer ) {
			logger.debug( "Client Disconnected! %s", peer.id );
		},

		error( peer ) {
			logger.debug( "Something went wrong! %s", peer.id );
		}
	}
} );

subscribeToGameEvents( "callbreak", ( { gameId, playerId, event, data } ) => {
	const topic = !!playerId ? `callbreak-${ gameId }-${ playerId }` : `callbreak-${ gameId }`;
	ws.publish( topic, { event, data } );
} );

subscribeToGameEvents( "literature", ( { gameId, playerId, event, data } ) => {
	const topic = !!playerId ? `literature-${ gameId }-${ playerId }` : `literature-${ gameId }`;
	ws.publish( topic, { event, data } );
} );

export const websocket = ws.websocket;

export async function handleUpgrade( request: Request, server: Server ) {
	const session = await auth.api.getSession( { headers: request.headers } );
	if ( !session || !session.user ) {
		logger.error( "Unauthorized!" );
		throw createError( { status: 401, message: "Unauthorized!" } );
	}

	return ws.handleUpgrade( request, server );
}