import { LoggerFactory } from "@backend/utils";
import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, type Socket } from "socket.io";
import { Constants } from "./literature.constants.ts";

@WebSocketGateway( {
	namespace: Constants.LITERATURE,
	cors: {
		origin: "https://stairway.yashgupta.me",
		credentials: true
	}
} )
export class LiteratureGateway implements OnGatewayConnection {

	@WebSocketServer() private server!: Server;

	private readonly logger = LoggerFactory.getLogger( LiteratureGateway );

	publishPlayerEvent( gameId: string, playerId: string, event: string, data: any ) {
		const eventKey = gameId.concat( ":" ).concat( playerId ).concat( ":" ).concat( event );
		this.server.to( gameId ).emit( eventKey, data );
		this.logger.debug( "Published Direct Message to %s", eventKey );
	}

	publishGameEvent( gameId: string, event: string, data: any ) {
		const eventKey = gameId.concat( ":" ).concat( event );
		this.server.to( gameId ).emit( eventKey, data );
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