import { CardHand, type IPlayingCard, PlayingCard } from "@stairway/cards";
import type {
	Ask,
	Call,
	CardCounts,
	Game,
	GameStatus,
	Player,
	PlayerData,
	ScoreUpdate,
	TeamData,
	Transfer
} from "@stairway/clients/literature";
import { produce } from "immer";
import { create } from "zustand";

export type PlayerGameData = {
	playerId: string;
	game: Game;
	players: PlayerData;
	teams: TeamData;
	cardCounts: CardCounts;
	hand: CardHand;
	lastMoveData?: { move?: Ask | Transfer, isCall: false } | { move: Call, isCall: true };
}

export type GameEventHandlers = {
	handlePlayerJoinedEvent: ( newPlayer: Player ) => void;
	handleTeamsCreatedEvent: ( teams: TeamData ) => void;
	handleCardAskedEvent: ( ask: Ask ) => void;
	handleSetCalledEvent: ( call: Call ) => void;
	handleTurnTransferredEvent: ( transfer: Transfer ) => void;
	handleTurnUpdatedEvent: ( nextTurn: string ) => void;
	handleScoreUpdatedEvent: ( scoreUpdate: ScoreUpdate ) => void;
	handleStatusUpdatedEvent: ( status: GameStatus ) => void;
	handleCardCountsUpdatedEvent: ( cardCounts: CardCounts ) => void;
	handleGameCompletedEvent: () => void;
	handleCardsDealtEvent: ( cards: IPlayingCard[] ) => void;
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
		hand: CardHand.empty()
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
						state.data.hand.addCard( data.cardId );
					}

					if ( data.askedFrom === state.data.playerId && data.success ) {
						state.data.hand.removeCard( data.cardId );
					}
				} )
			);
		},
		handleSetCalledEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.game.lastMoveId = data.id;
					state.data.lastMoveData = { isCall: true, move: data };
					state.data.hand.removeCards( Object.keys( data.correctCall as unknown as Record<string, string> ) );
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
		handleCardsDealtEvent: ( data ) => {
			set(
				produce<GameStore>( state => {
					state.data.hand = CardHand.from( data.map( PlayingCard.from ) );
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