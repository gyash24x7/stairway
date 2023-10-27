import { Fragment, ReactNode, useEffect } from "react";
import { socket } from "./socket";

export interface LiveUpdatesProviderProps {
	gameId: string;
	playerId: string;
	gameEvents?: Record<string, ( data: any ) => void>;
	playerEvents?: Record<string, ( data: any ) => void>;
	children: ReactNode;
}

export function LiveUpdatesProvider( props: LiveUpdatesProviderProps ) {
	const { children, gameEvents = {}, playerEvents = {}, gameId, playerId } = props;

	useEffect( () => {
		socket.on( "connect", () => {
			socket.emit( "join-room", gameId );
		} );

		Object.keys( gameEvents ).map( event => {
			socket.on( event, ( data ) => {
				console.log( "Event Received: ", event, data );
				const handler = gameEvents[ event ];
				handler( data );
			} );
			socket.emit( "subscription", { event, gameId, playerId } );
		} );

		Object.keys( playerEvents ).map( event => {
			socket.on( event.concat( "_" ).concat( playerId ), ( data ) => {
				console.log( "Event Received: ", event, data );
				playerEvents[ event ]( data );
			} );
			socket.emit( "subscription", { event, gameId, playerId } );
		} );

		return () => {
			socket.off( "connect" );
			Object.keys( gameEvents ).map( event => {
				socket.off( event, gameEvents[ event ] );
			} );

			Object.keys( playerEvents ).map( event => {
				socket.off( event.concat( "_" ).concat( playerId ), playerEvents[ event ] );
			} );
		};
	}, [] );

	return <Fragment>{ children }</Fragment>;
}