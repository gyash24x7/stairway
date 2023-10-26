import { useAuthStore } from "@auth/ui";
import { Fragment, ReactNode, useEffect } from "react";
import { socket } from "./socket";

export interface LiveUpdatesProviderProps {
	room: string;
	gameEvents?: Record<string, ( data: any ) => void>;
	playerEvents?: Record<string, ( data: any ) => void>;
	children: ReactNode;
}

export function LiveUpdatesProvider( props: LiveUpdatesProviderProps ) {
	const { children, gameEvents = {}, playerEvents = {}, room } = props;
	const authInfo = useAuthStore( state => state.authInfo );

	useEffect( () => {
		socket.on( "connect", () => {
			socket.emit( "join-room", room );
		} );

		Object.keys( gameEvents ).map( eventId => {
			socket.on( eventId, ( data ) => {
				console.log( "Event Received: ", eventId, data );
				gameEvents[ eventId ]( data );
			} );
			socket.emit( "subscription", { event: eventId, gameId: room, playerId: authInfo!.id } );
		} );

		Object.keys( playerEvents ).map( eventId => {
			socket.on( eventId.concat( "_" ).concat( authInfo!.id ), ( data ) => {
				console.log( "Event Received: ", eventId, data );
				playerEvents[ eventId ]( data );
			} );
			socket.emit( "subscription", { event: eventId, gameId: room, playerId: authInfo!.id } );
		} );

		return () => {
			socket.off( "connect" );
			Object.keys( gameEvents ).map( eventId => {
				socket.off( eventId, gameEvents[ eventId ] );
			} );

			Object.keys( playerEvents ).map( eventId => {
				socket.off( eventId.concat( "_" ).concat( authInfo!.id ), playerEvents[ eventId ] );
			} );
		};
	}, [] );

	return <Fragment>{ children }</Fragment>;
}