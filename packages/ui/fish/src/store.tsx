import { toast } from "@s2h-ui/primitives/sonner";
import type { PlayerGameInfo } from "@s2h/fish/types";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";

type StoreType = PlayerGameInfo & {
	lastNotification?: string;
};

export const store = new Store<StoreType>( {
	metrics: {},
	createdBy: "",
	cardLocations: {},
	cardCounts: {},
	claimHistory: [],
	config: {
		playerCount: 6,
		teamCount: 2,
		type: "NORMAL",
		books: [],
		deckType: 48,
		bookSize: 4
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

export function handleGameUpdate( data: PlayerGameInfo, message: string ) {
	store.setState( state => produce( state, draft => {
		if ( draft.lastNotification !== message ) {
			toast.info( message );
		}

		Object.assign( draft, data );
		draft.lastNotification = message;
	} ) );
}
