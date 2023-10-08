import { Namespace, Server } from "socket.io";
import { HttpAdapterHost } from "@nestjs/core";
import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class RealtimeService implements OnModuleInit {
	private io: Server;
	private namespaces: Record<string, Namespace> = {};

	constructor( readonly httpAdapter: HttpAdapterHost ) {
		this.io = new Server( 8001, {
			cors: {
				origin: [ "http://localhost:3000" ],
				allowedHeaders: [ "Authorization" ],
				credentials: true
			}
		} );

		this.namespaces[ "LITERATURE" ] = this.io.of( "/literature" );
	}

	publishMessage( namespace: string, key: string, message: any ) {
		this.namespaces[ namespace ].emit( key, message );
	}

	onModuleInit() {
		Object.values( this.namespaces ).forEach( namespace => {
			namespace.on( "connection", socket => {
				console.log( "New Client Connected!" );
				console.log( `Socket: ${ socket.id }` );
				socket.emit( "welcome", { message: `Welcome to ${ namespace.name }!` } );
				socket.on( "disconnect", () => {
					console.log( "Client Disconnected!" );
					console.log( `Socket: ${ socket.id }` );
				} );
			} );
		} );
	}
}