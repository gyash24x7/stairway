import { Manager, Socket } from "socket.io-client";

const socketMap = new Map<string, Socket>();

export function initializeSocketForNamespace( namespace: string ) {
	const manager = new Manager( "ws://localhost:8000" );
	const socket = manager.socket( "/" + namespace );
	socketMap.set( namespace, socket );

	socket.on( "connect", () => {
		console.log( "WebSocket connection established!" );
	} );
}

export function subscribeToEvents(
	namespace: string,
	roomId: string,
	memberId: string,
	roomEventsMap?: Record<string, ( data?: any ) => void>,
	memberEventsMap?: Record<string, ( data?: any ) => void>
) {
	const socket = socketMap.get( namespace );
	if ( !socket ) {
		throw new Error( "Socket not initialized for namespace: " + namespace );
	}

	socket.emit( "join-room", roomId );

	socket.on( "disconnect", () => {
		console.log( "WebSocket connection closed!" );
	} );

	if ( roomEventsMap ) {
		Object.keys( roomEventsMap ).forEach( event => {
			socket?.on( event, roomEventsMap[ event ] );
		} );
	}

	if ( memberEventsMap ) {
		Object.keys( memberEventsMap ).forEach( event => {
			const eventKey = event.concat( ":" ).concat( memberId );
			socket?.on( eventKey, memberEventsMap[ event ] );
		} );
	}

	return () => {
		socket.emit( "leave-room", roomId );

		if ( roomEventsMap ) {
			Object.keys( roomEventsMap ).forEach( event => {
				socket.off( event, roomEventsMap[ event ] );
			} );
		}

		if ( memberEventsMap ) {
			Object.keys( memberEventsMap ).forEach( event => {
				const eventKey = event.concat( ":" ).concat( memberId );
				socket.off( eventKey, memberEventsMap[ event ] );
			} );
		}
	};
}