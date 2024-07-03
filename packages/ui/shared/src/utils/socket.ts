import type { Socket } from "socket.io-client";

export function initializeSocket(
	socket: Socket,
	roomId: string,
	memberId: string,
	roomEventsMap?: Record<string, ( data?: any ) => void>,
	memberEventsMap?: Record<string, ( data?: any ) => void>
) {

	socket.on( "connect", () => {
		console.log( "WebSocket connection established!" );

		socket.emit( "join-room", roomId );

		socket.on( "disconnect", () => {
			console.log( "WebSocket connection closed!" );
		} );

		if ( roomEventsMap ) {
			Object.keys( roomEventsMap ).forEach( event => {
				const eventKey = `${ roomId }:${ event }`;
				socket?.on( eventKey, ( data ) => {
					console.log( "Event Received ", eventKey );
					roomEventsMap[ event ]( data );
				} );
				console.log( "Subscribed to ", eventKey );
			} );
		}

		if ( memberEventsMap ) {
			Object.keys( memberEventsMap ).forEach( event => {
				const eventKey = `${ roomId }:${ memberId }:${ event }`;
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