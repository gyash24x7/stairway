import { trpc } from "./client";
import { useGameStore } from "./store";

// Game State Hooks
export const useGameId = () => useGameStore( state => state.gameData.id );
export const usePlayers = () => useGameStore( state => state.gameData.players );
export const useTeams = () => useGameStore( state => state.gameData.teams );
export const useMoves = () => useGameStore( state => state.gameData.moves );
export const useCurrentTurn = () => useGameStore( state => state.gameData.currentTurn );
export const useGameStatus = () => useGameStore( state => state.gameData.status );
export const useCardCounts = () => useGameStore( state => state.gameData.cardCounts );
export const usePlayerCount = () => useGameStore( state => state.gameData.playerCount );
export const useGameCode = () => useGameStore( state => state.gameData.code );

export const usePlayerId = () => useGameStore( state => state.playerSpecificData.id );
export const useHand = () => useGameStore( state => state.playerSpecificData.hand );
export const useCardSetsInHand = () => useGameStore( state => state.playerSpecificData.cardSets );

export const useMyTeam = () => useGameStore( state => {
	const { playerSpecificData, gameData } = state;
	if ( !playerSpecificData.teamId ) {
		return undefined;
	}
	return gameData.teams[ playerSpecificData.teamId ];
} );

export const useOppositeTeam = () => useGameStore( state => {
	const { playerSpecificData, gameData } = state;
	if ( !playerSpecificData.oppositeTeamId ) {
		return undefined;
	}
	return gameData.teams[ playerSpecificData.oppositeTeamId ];
} );

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
		[ PlayerSpecificEvents.HAND_UPDATED ]: state.handleHandUpdatedEvent
	};
} );

// Game Action Hooks
export const useCreateGameAction = trpc.createGame.useMutation;
export const useJoinGameAction = trpc.joinGame.useMutation;
export const useAddBotsAction = trpc.addBots.useMutation;
export const useCreateTeamsAction = trpc.createTeams.useMutation;
export const useStartGameAction = trpc.startGame.useMutation;
export const useAskCardAction = trpc.askCard.useMutation;
export const useCallSetAction = trpc.callSet.useMutation;
export const useTransferTurnAction = trpc.transferTurn.useMutation;