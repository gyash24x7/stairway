import { createServer } from "http";
import next from "next";
import { parse } from "node:url";
import { Server } from "socket.io";

const hostname = process.env[ "HOST" ] || "localhost";
const port = process.env[ "PORT" ] ? parseInt( process.env[ "PORT" ] ) : 3000;

async function main() {
	const nextApp = next( { dev: false, dir: "apps/web" } );
	const handle = nextApp.getRequestHandler();

	await nextApp.prepare();

	const httpServer = createServer( ( req, res ) => {
		const parsedUrl = parse( req.url ?? "", true );
		handle( req, res, parsedUrl );
	} );

	const io = new Server( httpServer );
	const internalNamespace = io.of( "/_internal" );
	const literatureNamespace = io.of( "/literature" );

	internalNamespace.on( "connection", socket => {
		console.log( "Backend Socket Connected!", socket.id );

		socket.on( "game-event", async ( payload ) => {
			console.debug( "Received game-event from backend!" );
			literatureNamespace.in( payload.gameId ).emit( payload.event, payload.data );
			console.debug( "Published event %s", payload.event );
		} );

		socket.on( "player-event", async ( payload ) => {
			console.debug( "Received player-event from backend!" );
			const event = `${ payload.playerId }:${ payload.event }`;
			literatureNamespace.in( payload.gameId ).emit( event, payload.data );
			console.debug( "Published event %s", event );
		} );
	} );

	literatureNamespace.on( "connection", ( socket ) => {
		console.log( "Client Connected!", socket.id );

		socket.on( "join-room", ( gameId ) => {
			console.debug( "Joining Room: %s", gameId );
			socket.join( gameId );
		} );

		socket.on( "leave-room", ( gameId ) => {
			console.debug( "Leaving Room: %s", gameId );
			socket.leave( gameId );
		} );

		socket.on( "disconnect", () => {
			console.warn( "Client Disconnected!" );
			console.warn( `Socket: ${ socket.id }` );
		} );
	} );

	httpServer.listen( port, hostname );

	console.log( `[ ready ] on http://${ hostname }:${ port }` );
}

main().catch( ( err ) => {
	console.error( err );
	process.exit( 1 );
} );
