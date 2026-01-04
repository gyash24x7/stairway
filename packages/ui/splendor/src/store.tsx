import { toast } from "@s2h-ui/primitives/sonner";
import type { PlayerGameInfo, Tokens } from "@s2h/splendor/types";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";

type StoreType = PlayerGameInfo & {
	local: {
		selectedTokens: Partial<Tokens>;
		lastNotification?: string;
		selectedCard?: string;
	};
}

export const store = new Store<StoreType>( {
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
	createdBy: "",
	local: {
		selectedTokens: {}
	}
} );

export function handleCardSelect( cardId: string ) {
	store.setState( state => produce( state, draft => {
		draft.local.selectedCard = cardId;
	} ) );
}

export function handleCardDeSelect() {
	store.setState( state => produce( state, draft => {
		draft.local.selectedCard = undefined;
	} ) );
}

export function handleSelectedTokenChange( tokens: Partial<Tokens> ) {
	store.setState( state => produce( state, draft => {
		draft.local.selectedTokens = tokens;
	} ) );
}

export function handleGameUpdate( data: PlayerGameInfo, message?: string ) {
	store.setState( state => produce( state, draft => {
		if ( draft.local.lastNotification !== message ) {
			toast.info( message );
		}

		Object.assign( draft, data );
		draft.local.lastNotification = message;
		draft.local.selectedTokens = {};
	} ) );
}