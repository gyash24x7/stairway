import type { PlayerGameInfo } from "@s2h/splendor/types";
import { useEffect } from "react";
import useWebSocket from "react-use-websocket";
import { DisplayGame } from "./display-game.tsx";
import { handleGameUpdate } from "./store.tsx";

export function SplendorGamePage( props: { data: PlayerGameInfo } ) {
	const protocol = window.location.protocol === "https:" ? "wss" : "ws";
	const host = window.location.host;
	const socketUrl = `${ protocol }://${ host }/ws/splendor/${ props.data.id }`;

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
		handleGameUpdate( props.data );
	}, [ props.data ] );

	return <DisplayGame/>;
}