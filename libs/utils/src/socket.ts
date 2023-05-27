import console from "console";
import * as http from "node:http";
import { Namespace, Server } from "socket.io";
import { logger } from "./logger";

export async function initializeSocketServer( server: http.Server, ...namespaces: string[] ) {
	logger.debug( ">> initializeSocketServer()" );
	logger.debug( "Applications: %o", namespaces );

	const io = new Server( server, {
		cors: {
			origin: [ "http://localhost:3000" ],
			allowedHeaders: [ "Authorization" ],
			credentials: true
		}
	} );

	namespaces.forEach( namespaceName => {
		const namespace = io.of( `/${ namespaceName }` );

		namespace.on( "connection", socket => {
			console.log( "New Client Connected!" );
			console.log( `Socket: ${ socket.id }` );

			socket.on( "disconnect", () => {
				console.log( "Client Disconnected!" );
				console.log( `Socket: ${ socket.id }` );
			} );
		} );
	} );

	logger.debug( "Socket Server Initialized!" );
}

export class Publisher<T extends { id: string }> {
	private readonly namespace: Namespace;

	constructor( namespace: Namespace ) {
		this.namespace = namespace;
	}

	publish( gameData: T ) {
		logger.debug( "Publishing GameData..." );
		this.namespace.emit( gameData.id, gameData );
	}
}