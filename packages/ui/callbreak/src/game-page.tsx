import type { PlayerGameInfo } from "@s2h/callbreak/types";
import { useEffect } from "react";
import useWebSocket from "react-use-websocket";
import { DisplayGame } from "./display-game";
import { store } from "./store";

export function CallbreakGamePage( props: { data: PlayerGameInfo } ) {
	const protocol = window.location.protocol === "https:" ? "wss" : "ws";
	const host = window.location.host;
	const socketUrl = `${ protocol }://${ host }/ws/callbreak/${ props.data.id }`;

	useWebSocket( socketUrl, {
		shouldReconnect: () => true,
		onOpen: () => console.log( "WebSocket connection established" ),
		onClose: () => console.log( "WebSocket connection closed" ),
		onError: ( error ) => console.error( "WebSocket error:", error ),
		onMessage: ( { data }: MessageEvent ) => {
			store.setState( JSON.parse( data ) );
		}
	} );

	useEffect( () => {
		store.setState( props.data );
	}, [ props.data ] );

	return <DisplayGame/>;
}