import type { PlayerGameInfo } from "@s2h/splendor/types";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";

export const store = new Store<PlayerGameInfo>( {
	id: "",
	playerId: "",
	code: "",
	status: "CREATED",
	playerCount: 4,
	players: {},
	tokens: { diamond: 7, sapphire: 7, emerald: 7, ruby: 7, onyx: 7, gold: 5 },
	cards: { 1: [], 2: [], 3: [] },
	nobles: [],
	currentTurn: "",
	playerOrder: [],
	createdBy: ""
} );

export function handleGameUpdate( data: PlayerGameInfo, _message: string ) {
	store.setState( state => produce( state, draft => {
		// if ( draft.lastNotification !== message ) {
		// 	toast.info( message );
		// }

		Object.assign( draft, data );
		// draft.lastNotification = message;
	} ) );
}