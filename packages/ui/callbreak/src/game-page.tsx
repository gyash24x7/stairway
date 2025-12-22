import type { PlayerGameInfo } from "@s2h/callbreak/types";
import { useEffect } from "react";
import useWebSocket from "react-use-websocket";
import { DisplayGame } from "./display-game.tsx";
import { handleGameUpdate, store } from "./store.tsx";

export function CallbreakGamePage( props: { data: PlayerGameInfo } ) {
	const protocol = window.location.protocol === "https:" ? "wss" : "ws";
	const host = window.location.host;
	const socketUrl = `${ protocol }://${ host }/ws/callbreak/${ props.data.id }`;

	useWebSocket( socketUrl, {
		shouldReconnect: () => true,
		onOpen: () => console.log( "WebSocket connection established" ),
		onClose: () => console.log( "WebSocket connection closed" ),
		onError: ( error ) => console.error( "WebSocket error:", error ),
		onMessage: ( event: MessageEvent ) => {
			const { message, data } = JSON.parse( event.data ) as { data: PlayerGameInfo, message: string };
			handleGameUpdate( data, message );
		}
	} );

	useEffect( () => {
		store.setState( { ...props.data, play: {} } );
	}, [ props.data ] );

	return <DisplayGame/>;
}