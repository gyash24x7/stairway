import { useAction } from "@s2h/ui";
import { literatureClient } from "./client";
import { useGameStore } from "./store";

// Game State Hooks
export const useGameData = () => useGameStore( state => state.gameData );
export const usePlayerData = () => useGameStore( state => state.playerData );

export const useGameId = () => useGameStore( state => state.gameData.id );
export const usePlayers = () => useGameStore( state => state.gameData.players );
export const useTeams = () => useGameStore( state => state.gameData.teams );
export const useMoves = () => useGameStore( state => state.gameData.moves );
export const useCurrentTurn = () => useGameStore( state => state.gameData.currentTurn );
export const useGameStatus = () => useGameStore( state => state.gameData.status );
export const useCardCounts = () => useGameStore( state => state.gameData.cardCounts );
export const usePlayerCount = () => useGameStore( state => state.gameData.playerCount );
export const useGameCode = () => useGameStore( state => state.gameData.code );

export const usePlayerId = () => useGameStore( state => state.playerData.id );
export const useHand = () => useGameStore( state => state.playerData.hand );
export const useInferences = () => useGameStore( state => state.playerData.inferences );
export const useCardSetsInHand = () => useGameStore( state => state.playerData.cardSets );

export const useMyTeam = () => useGameStore( state => {
	const { playerData, gameData } = state;
	if ( !playerData.teamId ) {
		return undefined;
	}
	return gameData.teams[ playerData.teamId ];
} );

export const useOppositeTeam = () => useGameStore( state => {
	const { playerData, gameData } = state;
	if ( !playerData.oppositeTeamId ) {
		return undefined;
	}
	return gameData.teams[ playerData.oppositeTeamId ];
} );

// Game Event Handler Hooks

const GameEvents = {
	PLAYER_JOINED: "player-joined",
	TEAMS_CREATED: "teams-created",
	MOVE_CREATED: "move-created",
	TURN_UPDATED: "turn-updated",
	SCORE_UPDATED: "score-updated",
	STATUS_UPDATED: "status-updated",
	CARD_COUNT_UPDATED: "card-count-updated"
};

const PlayerSpecificEvents = {
	HAND_UPDATED: "hand-updated",
	INFERENCES_UPDATED: "inferences-updated"
};

export const useGameEventHandlers = () => useGameStore( state => {
	return {
		[ GameEvents.PLAYER_JOINED ]: state.handlePlayerJoinedEvent,
		[ GameEvents.TEAMS_CREATED ]: state.handleTeamsCreatedEvent,
		[ GameEvents.MOVE_CREATED ]: state.handleMoveCreatedEvent,
		[ GameEvents.TURN_UPDATED ]: state.handleTurnUpdatedEvent,
		[ GameEvents.SCORE_UPDATED ]: state.handleScoreUpdatedEvent,
		[ GameEvents.STATUS_UPDATED ]: state.handleStatusUpdatedEvent,
		[ GameEvents.CARD_COUNT_UPDATED ]: state.handleCardCountsUpdatedEvent
	};
} );

export const usePlayerSpecificEventHandlers = () => useGameStore( state => {
	return {
		[ PlayerSpecificEvents.HAND_UPDATED ]: state.handleHandUpdatedEvent,
		[ PlayerSpecificEvents.INFERENCES_UPDATED ]: state.handleInferencesUpdatedEvent
	};
} );

// Game Action Hooks
export const useCreateGameAction = () => useAction( literatureClient.createGame );
export const useJoinGameAction = () => useAction( literatureClient.joinGame );
export const useStartGameAction = () => useAction( literatureClient.startGame );
export const useCreateTeamsAction = () => useAction( literatureClient.createTeams );
export const useAskCardAction = () => useAction( literatureClient.askCard );
export const useCallSetAction = () => useAction( literatureClient.callSet );
export const useTransferTurnAction = () => useAction( literatureClient.transferTurn );