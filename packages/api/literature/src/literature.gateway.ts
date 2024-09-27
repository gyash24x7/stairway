import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { format } from "node:util";
import { Server, type Socket } from "socket.io";
import { Constants } from "./literature.constants.ts";

const FRONTEND_URL = Bun.env[ "FRONTEND_URL" ] ?? "http://localhost:3000";

@WebSocketGateway( {
	namespace: Constants.LITERATURE,
	cors: {
		origin: FRONTEND_URL,
		credentials: true
	}
} )
export class LiteratureGateway implements OnGatewayConnection {

	@WebSocketServer() private server!: Server;

	constructor( @OgmaLogger( LiteratureGateway ) private readonly logger: OgmaService ) {}

	publishPlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
		const eventKey = `${ playerId }:${ event }`;
		this.server.to( gameId ).emit( eventKey, data );
		this.logger.debug( format( "Published Direct Message to %s", eventKey ) );
	}

	publishGameEvent( gameId: string, event: string, data: any ) {
		this.server.to( gameId ).emit( event, data );
		this.logger.debug( format( "Published Room Message to %s", gameId ) );
	}

	handleConnection( socket: Socket ) {
		this.logger.debug( "New Client Connected!" );
		this.logger.debug( `Socket: ${ socket.id }` );

		socket.on( "join-room", ( gameId: string ) => {
			this.logger.debug( format( "Joining Room: %s", gameId ) );
			socket.join( gameId );
		} );

		socket.on( "leave-room", ( gameId: string ) => {
			this.logger.debug( format( "Leaving Room: %s", gameId ) );
			socket.leave( gameId );
		} );

		socket.on( "disconnect", () => {
			this.logger.warn( "Client Disconnected!" );
			this.logger.warn( `Socket: ${ socket.id }` );
		} );
	}
}