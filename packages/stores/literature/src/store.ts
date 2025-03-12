import {
	addCardToHand,
	getCardFromId,
	type PlayingCard,
	removeCardFromHand,
	removeCardsFromHand
} from "@stairway/cards";
import type { Literature } from "@stairway/types/literature";
import { produce } from "immer";
import { create } from "zustand";

export type PlayerGameData = {
	playerId: string;
	game: Literature.Game;
	players: Literature.PlayerData;
	teams: Literature.TeamData;
	cardCounts: Literature.CardCounts;
	hand: PlayingCard[];
	lastMoveData?: { move?: Literature.Ask | Literature.Transfer, isCall: false }
		| { move: Literature.Call, isCall: true };
	asks: Literature.Ask[];
	metrics: Literature.Metrics
}

export type GameEventHandlers = {
	handlePlayerJoinedEvent: ( newPlayer: Literature.Player ) => void;
	handleTeamsCreatedEvent: ( teams: Literature.TeamData ) => void;
	handleCardAskedEvent: ( ask: Literature.Ask ) => void;
	handleSetCalledEvent: ( call: Literature.Call ) => void;
	handleTurnTransferredEvent: ( transfer: Literature.Transfer ) => void;
	handleTurnUpdatedEvent: ( nextTurn: string ) => void;
	handleScoreUpdatedEvent: ( scoreUpdate: Literature.ScoreUpdate ) => void;
	handleStatusUpdatedEvent: ( status: Literature.GameStatus ) => void;
	handleCardCountsUpdatedEvent: ( cardCounts: Literature.CardCounts ) => void;
	handleGameCompletedEvent: ( metrics: Literature.Metrics ) => void;
	handleCardsDealtEvent: ( cards: PlayingCard[] ) => void;
}

export type GameStore = {
	data: PlayerGameData;
	eventHandlers: GameEventHandlers;
}

export const useGameStore = create<GameStore>( set => ( {
	data: {
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
	},
	eventHandlers: {
		handlePlayerJoinedEvent: ( newPlayer ) => {
			set(
				produce<GameStore>( state => {
					state.data.players[ newPlayer.id ] = newPlayer;
				} )
			);
		},
		handleTeamsCreatedEvent: ( teams ) => {
			set(
				produce<GameStore>( state => {
					state.data.teams = teams;
					Object.values( teams ).map( team => {
						team.memberIds.forEach( memberId => {
							state.data.players[ memberId ].teamId = team.id;
						} );
					} );
				} )
			);
		},
		handleCardAskedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.game.lastMoveId = data.id;
					state.data.lastMoveData = { isCall: false, move: data };
					if ( data.playerId === state.data.playerId && data.success ) {
						state.data.hand = addCardToHand( state.data.hand, getCardFromId( data.cardId ) );
					}

					if ( data.askedFrom === state.data.playerId && data.success ) {
						state.data.hand = removeCardFromHand( state.data.hand, getCardFromId( data.cardId ) );
					}

					state.data.asks.unshift( data );
				} )
			);
		},
		handleSetCalledEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.game.lastMoveId = data.id;
					state.data.lastMoveData = { isCall: true, move: data };
					state.data.hand = removeCardsFromHand(
						state.data.hand,
						Object.keys( data.correctCall ).map( getCardFromId )
					);
				} )
			);
		},
		handleTurnTransferredEvent: ( transfer ) => {
			set(
				produce<GameStore>( state => {
					state.data.game.lastMoveId = transfer.id;
					state.data.lastMoveData = { isCall: false, move: transfer };
				} )
			);
		},
		handleTurnUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.game.currentTurn = data;
				} )
			);
		},
		handleScoreUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.teams[ data.teamId ].score = data.score;
					state.data.teams[ data.teamId ].setsWon =
						[ data.setWon, ...state.data.teams[ data.teamId ].setsWon ];
				} )
			);
		},
		handleStatusUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.game.status = data;
				} )
			);
		},
		handleCardCountsUpdatedEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.cardCounts = data;
				} )
			);
		},
		handleCardsDealtEvent: ( cards ) => {
			set(
				produce<GameStore>( state => {
					state.data.hand = cards;
				} )
			);
		},
		handleGameCompletedEvent: ( metrics ) => {
			set(
				produce<GameStore>( state => {
					state.data.game.status = "COMPLETED";
					state.data.metrics = metrics;
				} )
			);
		}
	}
} ) );