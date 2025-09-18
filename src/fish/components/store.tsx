import type { Book, BookState, PlayerGameInfo } from "@/fish/types";
import { Store } from "@tanstack/react-store";
import { Fragment, type ReactNode, useEffect } from "react";

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
	useEffect( () => {
		store.setState( props.data );
	}, [ props.data ] );

	return <Fragment>{ props.children }</Fragment>;
}
