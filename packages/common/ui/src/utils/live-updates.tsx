import { Fragment, ReactNode, useCallback, useEffect } from "react";
//@ts-ignore
import { connect } from "socket.io-client";

export interface LiveUpdatesProviderProps {
	socketUrl: string;
	gameId: string;
	playerId: string;
	gameEventHandlers?: Record<string, ( data: any ) => void>;
	playerEventHandlers?: Record<string, ( data: any ) => void>;
	children: ReactNode;
}

const socket = connect( "ws://localhost:8001/literature" );
socket.on( "connect", () => {
	console.log( "WebSocket connection established!" );
} );

export function LiveUpdatesProvider( props: LiveUpdatesProviderProps ) {

	const initializeSocket = useCallback(
		() => {
			socket.emit( "join-room", props.gameId );

			socket.on( "disconnect", () => {
				console.log( "WebSocket connection closed!" );
			} );

			if ( props.gameEventHandlers ) {
				Object.keys( props.gameEventHandlers ).forEach( event => {
					socket?.on( event, props.gameEventHandlers![ event ] );
				} );
			}

			if ( props.playerEventHandlers ) {
				Object.keys( props.playerEventHandlers ).forEach( event => {
					const eventKey = event.concat( ":" ).concat( props.playerId );
					socket?.on( eventKey, props.playerEventHandlers![ event ] );
				} );
			}
		},
		[ props.gameEventHandlers, props.playerEventHandlers, props.playerId, props.gameId ]
	);

	const resetSocket = useCallback(
		() => {
			socket.emit( "leave-room", props.gameId );

			if ( props.gameEventHandlers ) {
				Object.keys( props.gameEventHandlers ).forEach( event => {
					socket?.off( event );
				} );
			}

			if ( props.playerEventHandlers ) {
				Object.keys( props.playerEventHandlers ).forEach( event => {
					const eventKey = event.concat( ":" ).concat( props.playerId );
					socket.off( eventKey );
				} );
			}
		},
		[ props.playerEventHandlers, props.gameEventHandlers, props.playerId, props.gameId ]
	);


	useEffect( () => {
		initializeSocket();
		return resetSocket;
	}, [] );

	return <Fragment>{ props.children } </Fragment>;
}