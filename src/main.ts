import { subscribeToGameEvents } from "@/server/utils/events";
import { createLogger } from "@/server/utils/logger";
import next from "next";
import { createServer } from "node:http";
import { Server } from "socket.io";

const logger = createLogger( "Main" );
const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next( { dev, hostname, port } );
const handler = app.getRequestHandler();

app.prepare().then( async () => {
	const httpServer = createServer( handler );

	const io = new Server( httpServer );

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

	httpServer
		.once( "error", ( err ) => {
			console.error( err );
			process.exit( 1 );
		} )
		.listen( port, () => {
			logger.info( `> Ready on http://${ hostname }:${ port }` );
		} );
} );