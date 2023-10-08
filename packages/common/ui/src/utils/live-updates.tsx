import { Fragment, ReactNode, useEffect, useState } from "react";
import { socket } from "./socket";

export interface LiveUpdatesProviderProps {
	eventMap: Record<string, ( data: any ) => void>;
	children: ReactNode;
}

export function LiveUpdatesProvider( { children, eventMap }: LiveUpdatesProviderProps ) {
	const [ _, setIsConnected ] = useState( socket.connected );

	useEffect( () => {
		function onConnect() {
			setIsConnected( true );
		}

		function onDisconnect() {
			setIsConnected( false );
		}

		function onWelcomeEvent() {
			console.log( "Received Welcome!" );
		}

		socket.on( "connect", onConnect );
		socket.on( "disconnect", onDisconnect );
		socket.on( "welcome", onWelcomeEvent );

		Object.keys( eventMap ).map( eventId => {
			socket.on( eventId, eventMap[ eventId ] );
		} );

		return () => {
			socket.off( "connect", onConnect );
			socket.off( "disconnect", onDisconnect );
			socket.off( "welcome", onWelcomeEvent );
			Object.keys( eventMap ).map( eventId => {
				socket.off( eventId, eventMap[ eventId ] );
			} );
		};
	}, [ eventMap ] );

	return <Fragment>{ children }</Fragment>;
}