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
} from "@literature/api";
import { CardHand, type IPlayingCard, PlayingCard } from "@stairway/cards";
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
					state.data.hand.removeCards( Object.keys( data.correctCall ) );
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

export const useGameId = () => useGameStore( state => state.data.game.id );
export const usePlayerCount = () => useGameStore( state => state.data.game.playerCount );
export const useGameCode = () => useGameStore( state => state.data.game.code );
export const usePlayerId = () => useGameStore( state => state.data.playerId );
export const usePlayers = () => useGameStore( state => state.data.players );
export const useTeams = () => useGameStore( state => state.data.teams );
export const useGameStatus = () => useGameStore( state => state.data.game.status );
export const useCurrentTurn = () => useGameStore( state => state.data.game.currentTurn );
export const useHand = () => useGameStore( state => state.data.hand );
export const useLastMove = () => useGameStore( state => state.data.lastMoveData?.move );
export const useCardSetsInHand = () => useGameStore( state => state.data.hand.sets );
export const useCardCounts = () => useGameStore( state => state.data.cardCounts );
export const useIsLastMoveSuccessfulCall = () => useGameStore(
	state => state.data.lastMoveData?.isCall && state.data.lastMoveData?.move.success
);

export const useMyTeam = () => useGameStore( state => {
	const player = state.data.players[ state.data.playerId ];
	if ( !player.teamId ) {
		return null;
	}
	return state.data.teams[ player.teamId ];
} );

export const useOppositeTeam = () => useGameStore( state => {
	const player = state.data.players[ state.data.playerId ];
	if ( !player.teamId ) {
		return null;
	}
	return Object.values( state.data.teams ).find( team => team.id !== player.teamId );
} );

const GameEvents = {
	PLAYER_JOINED: "player-joined",
	TEAMS_CREATED: "teams-created",
	CARD_ASKED: "card-asked",
	SET_CALLED: "set-called",
	TURN_TRANSFERRED: "turn-transferred",
	TURN_UPDATED: "turn-updated",
	SCORE_UPDATED: "score-updated",
	STATUS_UPDATED: "status-updated",
	CARD_COUNT_UPDATED: "card-count-updated",
	GAME_COMPLETED: "game-completed"
};

const PlayerSpecificEvents = {
	CARDS_DEALT: "cards-dealt"
};

export const useGameEventHandlers = () => useGameStore( state => {
	return {
		[ GameEvents.PLAYER_JOINED ]: state.eventHandlers.handlePlayerJoinedEvent,
		[ GameEvents.TEAMS_CREATED ]: state.eventHandlers.handleTeamsCreatedEvent,
		[ GameEvents.CARD_ASKED ]: state.eventHandlers.handleCardAskedEvent,
		[ GameEvents.SET_CALLED ]: state.eventHandlers.handleSetCalledEvent,
		[ GameEvents.TURN_TRANSFERRED ]: state.eventHandlers.handleTurnTransferredEvent,
		[ GameEvents.TURN_UPDATED ]: state.eventHandlers.handleTurnUpdatedEvent,
		[ GameEvents.SCORE_UPDATED ]: state.eventHandlers.handleScoreUpdatedEvent,
		[ GameEvents.STATUS_UPDATED ]: state.eventHandlers.handleStatusUpdatedEvent,
		[ GameEvents.CARD_COUNT_UPDATED ]: state.eventHandlers.handleCardCountsUpdatedEvent,
		[ GameEvents.GAME_COMPLETED ]: state.eventHandlers.handleGameCompletedEvent
	};
} );

export const usePlayerSpecificEventHandlers = () => useGameStore( state => {
	return {
		[ PlayerSpecificEvents.CARDS_DEALT ]: state.eventHandlers.handleCardsDealtEvent
	};
} );