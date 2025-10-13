import type { Book, BookState, PlayerGameInfo } from "@/fish/types";
import { Store } from "@tanstack/react-store";
import { Fragment, type ReactNode, useEffect } from "react";
import useWebSocket from "react-use-websocket";

export const store = new Store<PlayerGameInfo>( {
	metrics: {},
	bookStates: {} as Record<Book, BookState>,
	cardCounts: {},
	claimHistory: [],
	config: {
		playerCount: 6,
		teamCount: 2,
		type: "NORMAL",
		books: [],
		deckType: 48
	},
	playerIds: [],
	teamIds: [],
	transferHistory: [],
	playerId: "",
	id: "",
	code: "",
	status: "CREATED",
	currentTurn: "",
	players: {},
	teams: {},
	hand: [],
	askHistory: []
} );

export function StoreLoader( props: { children: ReactNode; data: PlayerGameInfo } ) {
	const protocol = window.location.protocol === "https:" ? "wss" : "ws";
	const host = window.location.host;
	const socketUrl = `${ protocol }://${ host }/ws/fish/${ props.data.id }`;

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

	return <Fragment>{ props.children }</Fragment>;
}
