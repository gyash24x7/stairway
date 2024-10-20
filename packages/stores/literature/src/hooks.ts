import { literature$ } from "./store.ts";

export const useGameId = () => literature$.data.game.id.get();
export const usePlayerCount = () => literature$.data.game.playerCount.get();
export const useGameCode = () => literature$.data.game.code.get();
export const usePlayerId = () => literature$.data.playerId.get();
export const usePlayers = () => literature$.data.players.get();
export const useTeams = () => literature$.data.teams.get();
export const useGameStatus = () => literature$.data.game.status.get();
export const useCurrentTurn = () => literature$.data.game.currentTurn.get();
export const useHand = () => literature$.data.hand.get();
export const useLastMove = () => literature$.data.lastMoveData?.move.get();
export const useCardCounts = () => literature$.data.cardCounts.get();
export const usePreviousAsks = () => literature$.data.asks.get();
export const useMetrics = () => literature$.data.metrics.get();
export const useIsLastMoveSuccessfulCall = () => literature$.data.lastMoveData.get()?.isCall &&
	literature$.data.lastMoveData.get()?.move?.success;

export const useMyTeam = () => {
	const playerId = usePlayerId();
	const teams = useTeams();
	const players = usePlayers();

	if ( !players[ playerId ].teamId ) {
		return null;
	}
	return teams[ players[ playerId ].teamId ];
};

export const useOppositeTeam = () => {
	const playerId = usePlayerId();
	const teams = useTeams();
	const players = usePlayers();

	if ( !players[ playerId ].teamId ) {
		return null;
	}

	return Object.values( teams ).find( team => team.id !== players[ playerId ].teamId );
};

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

export const useGameEventHandlers = () => {
	return {
		[ GameEvents.PLAYER_JOINED ]: literature$.eventHandlers.handlePlayerJoinedEvent,
		[ GameEvents.TEAMS_CREATED ]: literature$.eventHandlers.handleTeamsCreatedEvent,
		[ GameEvents.CARD_ASKED ]: literature$.eventHandlers.handleCardAskedEvent,
		[ GameEvents.SET_CALLED ]: literature$.eventHandlers.handleSetCalledEvent,
		[ GameEvents.TURN_TRANSFERRED ]: literature$.eventHandlers.handleTurnTransferredEvent,
		[ GameEvents.TURN_UPDATED ]: literature$.eventHandlers.handleTurnUpdatedEvent,
		[ GameEvents.SCORE_UPDATED ]: literature$.eventHandlers.handleScoreUpdatedEvent,
		[ GameEvents.STATUS_UPDATED ]: literature$.eventHandlers.handleStatusUpdatedEvent,
		[ GameEvents.CARD_COUNT_UPDATED ]: literature$.eventHandlers.handleCardCountsUpdatedEvent,
		[ GameEvents.GAME_COMPLETED ]: literature$.eventHandlers.handleGameCompletedEvent
	};
};

export const usePlayerSpecificEventHandlers = () => {
	return {
		[ PlayerSpecificEvents.CARDS_DEALT ]: literature$.eventHandlers.handleCardsDealtEvent
	};
}; 