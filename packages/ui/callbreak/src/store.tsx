import { toast } from "@s2h-ui/primitives/sonner";
import type { PlayerGameInfo } from "@s2h/callbreak/types";
import type { CardId } from "@s2h/utils/cards";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";

type StoreType = PlayerGameInfo & {
	play: { selectedCard?: CardId; };
	lastNotification?: string;
};

export const store = new Store<StoreType>( {
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
	hand: [],
	play: {}
} );

export function handleCardSelect( cardId?: CardId ) {
	store.setState( state => produce( state, draft => {
		draft.play.selectedCard = cardId;
	} ) );
}

export function handleGameUpdate( data: PlayerGameInfo, message: string ) {
	store.setState( state => produce( state, draft => {
		if ( draft.lastNotification !== message ) {
			toast.info( message );
		}

		Object.assign( draft, { ...data, play: draft.play } );
		draft.lastNotification = message;
	} ) );
}