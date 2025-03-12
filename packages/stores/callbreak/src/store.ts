import { getCardFromId, type PlayingCard, removeCardFromHand } from "@stairway/cards";
import type { Callbreak } from "@stairway/types/callbreak";
import { produce } from "immer";
import { create } from "zustand/react";

export type PlayerGameData = {
	playerId: string;
	game: Callbreak.Game;
	players: Callbreak.PlayerData;
	currentDeal?: Callbreak.Deal | null;
	currentRound?: Callbreak.Round | null;
	hand: PlayingCard[];
}

export type GameEventHandlers = {
	handlePlayerJoinedEvent: ( newPlayer: Callbreak.GameEventPayloads["player-joined"] ) => void;
	handleAllPlayersJoinedEvent: () => void;
	handleDealCreatedEvent: ( deal: Callbreak.GameEventPayloads["deal-created"] ) => void;
	handleDealWinDeclaredEvent: ( data: Callbreak.GameEventPayloads["deal-win-declared"] ) => void;
	handleAllDealWinsDeclaredEvent: () => void;
	handleRoundCreatedEvent: ( data: Callbreak.GameEventPayloads["round-created"] ) => void;
	handleCardPlayedEvent: ( data: Callbreak.GameEventPayloads["card-played"] ) => void;
	handleRoundCompletedEvent: ( data: Callbreak.GameEventPayloads["round-completed"] ) => void;
	handleDealCompletedEvent: ( data: Callbreak.GameEventPayloads["deal-completed"] ) => void;
	handleStatusUpdatedEvent: ( status: Callbreak.GameEventPayloads["status-updated"] ) => void;
	handleGameCompletedEvent: () => void;
	handleCardsDealtEvent: ( cards: Callbreak.PlayerEventPayloads["cards-dealt"] ) => void;
}

export type GameStore = {
	data: PlayerGameData;
	eventHandlers: GameEventHandlers;
}

export const useGameStore = create<GameStore>( ( set ) => ( {
	data: {
		playerId: "",
		game: {
			id: "",
			status: "CREATED",
			code: "",
			dealCount: 0,
			trumpSuit: "",
			createdBy: "",
			scores: []
		},
		players: {},
		hand: []
	},
	eventHandlers: {
		handlePlayerJoinedEvent: ( newPlayer ) => {
			set(
				produce<GameStore>( state => {
					state.data.players[ newPlayer.id ] = newPlayer;
				} )
			);
		},
		handleAllPlayersJoinedEvent: () => {
			set(
				produce<GameStore>( state => {
					state.data.game.status = "IN_PROGRESS";
				} )
			);
		},
		handleDealCreatedEvent: ( deal ) => {
			set(
				produce<GameStore>( state => {
					state.data.currentDeal = deal;
				} )
			);
		},
		handleAllDealWinsDeclaredEvent: () => {},
		handleDealWinDeclaredEvent: ( { deal } ) => {
			set(
				produce<GameStore>( state => {
					state.data.currentDeal = deal;
				} )
			);
		},
		handleRoundCreatedEvent: ( round ) => {
			set(
				produce<GameStore>( state => {
					state.data.currentDeal!.status = "IN_PROGRESS";
					state.data.currentRound = round;
				} )
			);
		},
		handleCardPlayedEvent: ( { round, by, card } ) => {
			set(
				produce<GameStore>( state => {
					state.data.currentRound = round;
					if ( by === state.data.playerId ) {
						state.data.hand = removeCardFromHand( state.data.hand, getCardFromId( card ) );
					}
				} )
			);
		},
		handleRoundCompletedEvent: ( { deal } ) => {
			set(
				produce<GameStore>( state => {
					state.data.currentRound = undefined;
					state.data.currentDeal = deal;
				} )
			);
		},
		handleDealCompletedEvent: ( { deal, score } ) => {
			set(
				produce<GameStore>( state => {
					state.data.currentDeal = deal;
					state.data.game.scores = [ score, ...state.data.game.scores as Record<string, number>[] ];
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
		handleCardsDealtEvent: ( cards ) => {
			set(
				produce<GameStore>( state => {
					state.data.hand = cards;
				} )
			);
		},
		handleGameCompletedEvent: () => {
			set(
				produce<GameStore>( state => {
					state.data.game.status = "COMPLETED";
				} )
			);
		}
	}
} ) );