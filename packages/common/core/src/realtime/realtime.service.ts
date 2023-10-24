import { Namespace, Server } from "socket.io";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { LoggerFactory } from "../logger";

@Injectable()
export class RealtimeService implements OnModuleDestroy {

	private readonly logger = LoggerFactory.getLogger( RealtimeService );

	private readonly io: Server;
	private namespaces: Record<string, Namespace> = {};

	constructor() {
		this.io = new Server( 8001, {
			cors: {
				origin: [ "http://localhost:3000" ],
				allowedHeaders: [ "Authorization" ],
				credentials: true
			}
		} );
	}

	registerNamespace( namespace: string ) {
		this.logger.debug( "Registering Namespace for %s", namespace );
		const ns = this.io.of( namespace.toLowerCase() );

		ns.on( "connection", socket => {
			this.logger.debug( "New Client Connected!" );
			this.logger.debug( `Socket: ${ socket.id }` );

			socket.on( "join-room", ( gameId: string ) => {
				this.logger.debug( "Joining Room: %s", gameId );
				socket.join( gameId );
			} );

			socket.on( "disconnect", () => {
				this.logger.warn( "Client Disconnected!" );
				this.logger.warn( `Socket: ${ socket.id }` );
			} );
		} );

		this.namespaces[ namespace ] = ns;
	}

	publishDirectMessage( namespace: string, gameId: string, playerId: string, event: string, data: any ) {
		const eventKey = event.concat( "_" ).concat( playerId );
		this.namespaces[ namespace ].to( gameId ).emit( eventKey, data );
		this.logger.debug( "Published Direct Message to %s. Message: %o", eventKey, data );
	}

	publishRoomMessage( namespace: string, gameId: string, event: string, data: any ) {
		this.namespaces[ namespace ].to( gameId ).emit( event, data );
		this.logger.debug( "Published Room Message to %s. Message: %o", gameId, data );
	}

	onModuleDestroy() {
		Object.values( this.namespaces ).forEach( namespace => {
			namespace.disconnectSockets( true );
		} );
	}
}