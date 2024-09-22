import { useGameStore } from "./store.ts";

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