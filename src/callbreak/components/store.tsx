"use client";

import type { PlayerGameInfo } from "@/callbreak/types";
import { Store } from "@tanstack/react-store";
import { Fragment, type ReactNode, useEffect } from "react";
import useWebSocket from "react-use-websocket";

export const store = new Store<PlayerGameInfo>( {
	playerId: "",
	id: "",
	status: "GAME_CREATED",
	code: "",
	dealCount: 0,
	trump: "D",
	createdBy: "",
	currentTurn: "",
	scores: {},
	players: {},
	hand: []
} );

export function StoreLoader( props: { children: ReactNode; data: PlayerGameInfo } ) {
	const protocol = window.location.protocol === "https:" ? "wss" : "ws";
	const host = window.location.host;
	const socketUrl = `${ protocol }://${ host }/ws/callbreak/${ props.data.id }`;

	const {} = useWebSocket( socketUrl, {
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

	return <Fragment>{ props.children }</Fragment>;
}