import { LoggerFactory } from "@common/core";
import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, type Socket } from "socket.io";
import { Constants } from "./wordle.constants";

@WebSocketGateway( {
	namespace: Constants.WORDLE,
	cors: {
		origin: "http://localhost:3000",
		credentials: true
	}
} )
export class WordleGateway implements OnGatewayConnection {

	@WebSocketServer() private server: Server;

	private readonly logger = LoggerFactory.getLogger( WordleGateway );

	publishEvent( gameId: string, event: string, data: any ) {
		const eventKey = gameId.concat( ":" ).concat( event );
		this.server.to( gameId ).emit( eventKey, data );
		this.logger.debug( "Published Message to %s", gameId );
	}

	handleConnection( socket: Socket ) {
		this.logger.debug( "New Client Connected!" );
		this.logger.debug( `Socket: ${ socket.id }` );

		socket.on( "join-room", ( gameId: string ) => {
			this.logger.debug( "Joining Room: %s", gameId );
			socket.join( gameId );
			this.logger.debug( this.server );
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