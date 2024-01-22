import { Injectable } from "@nestjs/common";
import type { Namespace, Server } from "socket.io";
import { LoggerFactory } from "../logger";

@Injectable()
export class RealtimeService {

	private readonly logger = LoggerFactory.getLogger( RealtimeService );

	private readonly namespaces: Map<string, Namespace> = new Map();

	registerNamespace( io: Server, namespace: string ) {
		this.logger.debug( ">> registerNamespace()" );
		this.logger.debug( "Registering Namespace for %s", namespace );
		const ns = io.of( namespace.toLowerCase() );

		ns.on( "connection", socket => {
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
		} );

		this.namespaces.set( namespace, ns );

		this.logger.debug( "<< registerNamespace()" );
	}

	publishMemberMessage( namespace: string, gameId: string, playerId: string, event: string, data: any ) {
		const eventKey = event.concat( ":" ).concat( playerId );
		const ns = this.namespaces.get( namespace )!;
		ns.to( gameId ).emit( eventKey, data );
		this.logger.debug( "Published Direct Message to %s", eventKey );
	}

	publishRoomMessage( namespace: string, gameId: string, event: string, data: any ) {
		const ns = this.namespaces.get( namespace )!;
		ns.to( gameId ).emit( event, data );
		this.logger.debug( "Published Room Message to %s", gameId );
	}
}
