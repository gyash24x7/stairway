import { Namespace, Server } from "socket.io";
import { logger } from "./logger";

export function initializeSocketNamespace<T extends { id: string; }>( io: Server, namespaceName: string ) {
	logger.debug( ">> initializeSocketNamespace()" );
	logger.debug( "Namespace: %o", namespaceName );

	const namespace = io.of( `/${ namespaceName }` );
	logger.debug( "Socket Namespace Initialized for %s!", namespaceName );

	namespace.on( "connection", socket => {
		logger.debug( "New Client Connected!" );
		logger.debug( `Socket: ${ socket.id }` );

		socket.on( "disconnect", () => {
			logger.debug( "Client Disconnected!" );
			logger.debug( `Socket: ${ socket.id }` );
		} );
	} );

	return new Publisher<T>( namespace );
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