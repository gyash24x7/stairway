import { io } from "socket.io-client";

export function initializeSocket(
	path: string,
	roomId: string,
	memberId: string,
	roomEventsMap?: Record<string, ( data?: any ) => void>,
	memberEventsMap?: Record<string, ( data?: any ) => void>
) {
	const url = process.env.NODE_ENV === "development" ? "http://localhost:8000".concat( path ) : path;
	const socket = io( url );

	socket.on( "connect", () => {
		console.log( "WebSocket connection established!" );

		socket.emit( "join-room", roomId );

		socket.on( "disconnect", () => {
			console.log( "WebSocket connection closed!" );
		} );

		if ( roomEventsMap ) {
			Object.keys( roomEventsMap ).forEach( event => {
				socket?.on( event, ( data ) => {
					console.log( "Event Received ", event );
					roomEventsMap[ event ]( data );
				} );
				console.log( "Subscribed to ", event );
			} );
		}

		if ( memberEventsMap ) {
			Object.keys( memberEventsMap ).forEach( event => {
				const eventKey = `${ memberId }:${ event }`;
				socket?.on( eventKey, ( data ) => {
					console.log( "Event Received ", eventKey );
					memberEventsMap[ event ]( data );
				} );
				console.log( "Subscribed to ", eventKey );
			} );
		}
	} );

	return () => {
		socket.emit( "leave-room", roomId );

		if ( roomEventsMap ) {
			Object.keys( roomEventsMap ).forEach( event => {
				const eventKey = `${ roomId }:${ event }`;
				socket.off( eventKey, roomEventsMap[ event ] );
				console.log( "Unsubscribed from ", eventKey );
			} );
		}

		if ( memberEventsMap ) {
			Object.keys( memberEventsMap ).forEach( event => {
				const eventKey = `${ roomId }:${ memberId }:${ event }`;
				socket.off( eventKey, memberEventsMap[ event ] );
				console.log( "Unsubscribed from ", eventKey );
			} );
		}
	};
}