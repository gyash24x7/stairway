import { subscribeToGameEvents } from "@/server/utils/events";
import { createLogger } from "@/server/utils/logger";
import { createServer } from "node:http";
import { Server } from "socket.io";

const logger = createLogger( "SocketIO" );
const httpServer = createServer();
const io = new Server( httpServer, {
	cors: {
		origin: "http://localhost:3000",
		credentials: true
	}
} );

const callbreakNS = io.of( "/_callbreak" );

callbreakNS.on( "connection", ( socket ) => {
	logger.info( "Client Connected!", socket.id );

	socket.on( "join-game", ( { gameId, playerId }: { gameId: string; playerId: string; } ) => {
		logger.info( "Joining Callbreak Game GameId: %s, PlayerId: %s", gameId, playerId );
		socket.join( gameId );
		socket.join( `${ gameId }-${ playerId }` );
	} );
} );

await subscribeToGameEvents( "callbreak", ( { gameId, playerId, event, data } ) => {
	logger.info( "Received Callbreak Game Event %s", event );
	callbreakNS.to( !playerId ? gameId : `${ gameId }-${ playerId }` ).emit( event, data );
} );

const literatureNS = io.of( "/_literature" );

literatureNS.on( "connection", ( socket ) => {
	logger.info( "Client Connected!", socket.id );

	socket.on( "join-game", ( { gameId, playerId }: { gameId: string; playerId: string; } ) => {
		logger.info( "Joining Literature Game GameId: %s, PlayerId: %s", gameId, playerId );
		socket.join( gameId );
		socket.join( `${ gameId }-${ playerId }` );
	} );
} );

await subscribeToGameEvents( "literature", ( { gameId, playerId, event, data } ) => {
	logger.info( "Received Literature Game Event %s", event );
	literatureNS.to( !playerId ? gameId : `${ gameId }-${ playerId }` ).emit( event, data );
} );

httpServer.listen( 8000 );