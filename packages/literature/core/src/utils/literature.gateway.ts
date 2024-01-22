import { LoggerFactory } from "@common/core";
import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, type Socket } from "socket.io";
import { Constants } from "./literature.constants";

@WebSocketGateway( { namespace: Constants.LITERATURE } )
export class LiteratureGateway implements OnGatewayConnection {

	@WebSocketServer() private server: Server;

	private readonly logger = LoggerFactory.getLogger( LiteratureGateway );

	publishMemberMessage( gameId: string, playerId: string, event: string, data: any ) {
		const eventKey = event.concat( ":" ).concat( playerId );
		this.server.to( gameId ).emit( eventKey, data );
		this.logger.debug( "Published Direct Message to %s", eventKey );
	}

	publishRoomMessage( gameId: string, event: string, data: any ) {
		this.server.to( gameId ).emit( event, data );
		this.logger.debug( "Published Room Message to %s", gameId );
	}

	handleConnection( socket: Socket ) {
		this.logger.debug( "New Client Connected!" );
		this.logger.debug( `Socket: ${ socket.id }` );

		socket.on( "join-room", ( gameId: string ) => {
			this.logger.debug( "Joining Room: %s", gameId );
			socket.join( gameId );
		} );

		socket.on( "leave-room", ( gameId: string ) => {
			this.logger.debug( "Leaving Room: %s", gameId );
			socket.leave( gameId );
		} );

		socket.on( "disconnect", () => {
			this.logger.warn( "Client Disconnected!" );
			this.logger.warn( `Socket: ${ socket.id }` );
		} );
	}
}