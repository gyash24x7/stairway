import { Fragment, ReactNode, useEffect } from "react";
import { socket } from "./socket";

export interface LiveUpdatesProviderProps {
	room: string;
	eventMap: Record<string, ( data: any ) => void>;
	children: ReactNode;
}

export function LiveUpdatesProvider( { children, eventMap, room }: LiveUpdatesProviderProps ) {

	useEffect( () => {
		socket.on( "connect", () => {
			socket.emit( "join-room", room );
		} );

		Object.keys( eventMap ).map( eventId => {
			socket.on( eventId, ( data ) => {
				console.log( "Got Event: " + eventId );
				console.log( data );
				eventMap[ eventId ]( data );
			} );
		} );

		return () => {
			socket.off( "connect" );
			Object.keys( eventMap ).map( eventId => {
				socket.off( eventId, eventMap[ eventId ] );
			} );
		};
	}, [] );

	return <Fragment>{ children }</Fragment>;
}