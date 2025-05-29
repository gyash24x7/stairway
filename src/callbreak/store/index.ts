import type { Callbreak } from "@/callbreak/types";
import { getCardDisplayString, getCardFromId } from "@/libs/cards/card";
import { removeCardFromHand } from "@/libs/cards/hand";
import { CardSuit } from "@/libs/cards/types";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";
import { toast } from "sonner";

export const store = new Store<Callbreak.Store>( {
	playerId: "",
	game: {
		id: "",
		status: "CREATED",
		code: "",
		dealCount: 0,
		trumpSuit: CardSuit.DIAMONDS,
		createdBy: ""
	},
	players: {},
	hand: [],
	scores: []
} );

export function handlePlayerJoinedEvent( newPlayer: Callbreak.EventPayloads["player-joined"] ) {
	store.setState( state => produce( state, draft => {
		draft.players[ newPlayer.id ] = newPlayer;
	} ) );

	toast.info( `${ newPlayer.name } joined the game!` );
}

export function handleAllPlayersJoinedEvent() {
	store.setState( state => produce( state, draft => {
		draft.game.status = "IN_PROGRESS";
	} ) );

	toast.info( "All Players Joined!" );
}

export function handleDealCreatedEvent( deal: Callbreak.EventPayloads["deal-created"] ) {
	store.setState( state => produce( state, draft => {
		draft.currentDeal = deal;
	} ) );

	toast.info( "New Deal Created!" );
}

export function handleCardsDealtEvent( cards: Callbreak.EventPayloads["cards-dealt"] ) {
	store.setState( state => produce( state, draft => {
		draft.hand = cards;
	} ) );
}

export function handleDealWinDeclaredEvent( { by, wins }: Callbreak.EventPayloads["deal-win-declared"] ) {
	store.setState( state => produce( state, draft => {
		if ( draft.currentDeal ) {
			draft.currentDeal.scores[ by.id ].declarations = wins;
		}
	} ) );

	toast.info( `${ by.name } declared ${ wins } wins!` );
}

export function handleAllDealWinsDeclaredEvent() {
	toast.info( "Everybody declared the wins. Starting round..." );
}

export function handleRoundCreatedEvent( round: Callbreak.EventPayloads["round-created"] ) {
	store.setState( state => produce( state, draft => {
		draft.currentDeal!.status = "IN_PROGRESS";
		draft.currentRound = { ...round, cards: {} };
	} ) );

	const turnPlayer = store.state.players[ round.playerOrder[ round.turnIdx ] ];
	toast.info( `New Round Created! ${ turnPlayer.name } to play card!` );
}

export function handleCardPlayedEvent( { by, card }: Callbreak.EventPayloads["card-played"] ) {
	store.setState( state => produce( state, draft => {
		if ( by === draft.playerId ) {
			draft.hand = removeCardFromHand( draft.hand, getCardFromId( card ) );
		}
	} ) );

	const player = store.state.players[ by ];
	toast.info( `${ player.name } played ${ getCardDisplayString( getCardFromId( card ) ) }!` );
}

export function handleRoundCompletedEvent( { winner }: Callbreak.EventPayloads["round-completed"] ) {
	store.setState( state => produce( state, draft => {
		if ( draft.currentDeal ) {
			draft.currentDeal.scores[ winner.id ].wins++;
		}
	} ) );

	toast.info( `Round Completed! ${ winner.name } Won!` );
}

export function handleDealCompletedEvent( { score }: Callbreak.EventPayloads["deal-completed"] ) {
	store.setState( state => produce( state, draft => {
		draft.scores.unshift( score );
		if ( draft.currentDeal ) {
			draft.currentDeal.status = "COMPLETED";
		}
	} ) );

	toast.info( `Deal Completed!` );
}

export function handleGameCompletedEvent() {
	store.setState( state => produce( state, draft => {
		draft.game.status = "COMPLETED";
	} ) );

	toast.info( `Game Completed!` );
}