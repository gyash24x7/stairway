import { getCardFromId } from "@/shared/cards/card";
import { addCardToHand, removeCardFromHand, removeCardsFromHand } from "@/shared/cards/hand";
import type { Literature } from "@/literature/types";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";
import { toast } from "sonner";

export const store = new Store<Literature.Store>( {
	playerId: "",
	game: {
		id: "",
		code: "",
		status: "CREATED",
		playerCount: 0,
		currentTurn: "",
		lastMoveId: ""
	},
	players: {},
	teams: {},
	cardCounts: {},
	hand: [],
	asks: [],
	metrics: { player: [], team: [] }
} );

export function handlePlayerJoinedEvent( newPlayer: Literature.EventPayloads["player-joined"] ) {
	store.setState( state => produce( state, draft => {
		draft.players[ newPlayer.id ] = newPlayer;
	} ) );

	toast.info( `${ newPlayer.name } joined the game!` );
}

export function handleTeamsCreatedEvent( teams: Literature.EventPayloads["teams-created"] ) {
	store.setState( state => produce( state, draft => {
		draft.teams = teams;
		Object.values( teams ).map( team => {
			team.memberIds.forEach( memberId => {
				draft.players[ memberId ].teamId = team.id;
			} );
		} );
	} ) );

	toast.info( "Teams created!" );
}

export function handleCardAskedEvent( ask: Literature.EventPayloads["card-asked"] ) {
	store.setState( state => produce( state, draft => {
		draft.game.lastMoveId = ask.id;
		draft.lastMoveData = { isCall: false, move: ask };
		if ( ask.playerId === draft.playerId && ask.success ) {
			draft.hand = addCardToHand( draft.hand, getCardFromId( ask.cardId ) );
		}

		if ( ask.askedFrom === draft.playerId && ask.success ) {
			draft.hand = removeCardFromHand( draft.hand, getCardFromId( ask.cardId ) );
		}

		draft.asks.unshift( ask );
	} ) );

	toast.info( ask.description );
}

export function handleSetCalledEvent( call: Literature.EventPayloads["set-called"] ) {
	store.setState( state => produce( state, draft => {
		draft.game.lastMoveId = call.id;
		draft.lastMoveData = { isCall: true, move: call };
		draft.hand = removeCardsFromHand( draft.hand, Object.keys( call.correctCall ).map( getCardFromId ) );
	} ) );

	toast.info( call.description );
}

export function handleTurnTransferredEvent( transfer: Literature.EventPayloads["turn-transferred"] ) {
	store.setState( state => produce( state, draft => {
		draft.game.lastMoveId = transfer.id;
		draft.lastMoveData = { isCall: false, move: transfer };
	} ) );

	toast.info( transfer.description );
}

export function handleTurnUpdatedEvent( nextTurn: Literature.EventPayloads["turn-updated"] ) {
	store.setState( state => produce( state, draft => {
		draft.game.currentTurn = nextTurn;
	} ) );
}

export function handleScoreUpdatedEvent( scoreUpdate: Literature.EventPayloads["score-updated"] ) {
	store.setState( state => produce( state, draft => {
		draft.teams[ scoreUpdate.teamId ].score = scoreUpdate.score;
		draft.teams[ scoreUpdate.teamId ].setsWon =
			[ scoreUpdate.setWon, ...draft.teams[ scoreUpdate.teamId ].setsWon ];
	} ) );
}

export function handleStatusUpdatedEvent( status: Literature.EventPayloads["status-updated"] ) {
	store.setState( state => produce( state, draft => {
		draft.game.status = status;
	} ) );
}

export function handleCardCountsUpdatedEvent( cardCounts: Literature.EventPayloads["card-count-updated"] ) {
	store.setState( state => produce( state, draft => {
		draft.cardCounts = cardCounts;
	} ) );
}

export function handleCardsDealtEvent( cards: Literature.EventPayloads["cards-dealt"] ) {
	store.setState( state => produce( state, draft => {
		draft.hand = cards;
	} ) );
}

export function handleGameCompletedEvent( metrics: Literature.EventPayloads["game-completed"] ) {
	store.setState( state => produce( state, draft => {
		draft.game.status = "COMPLETED";
		draft.metrics = metrics;
	} ) );

	toast.info( `Game Completed!` );
}
