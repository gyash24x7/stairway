import { getSetsInHand } from "@stairway/cards";
import { useShallow } from "zustand/shallow";
import { useGameStore } from "./store";

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

export const useCardSetsInHand = () => useGameStore( useShallow( state => getSetsInHand( state.data.hand ) ) );

export const useCardCounts = () => useGameStore( state => state.data.cardCounts );

export const usePreviousAsks = () => useGameStore( state => state.data.asks );

export const useMetrics = () => useGameStore( state => state.data.metrics );

export const useIsLastMoveSuccessfulCall = () => useGameStore(
	state => state.data.lastMoveData?.isCall && state.data.lastMoveData?.move.success
);

export const useMyTeam = () => useGameStore( useShallow( state => {
	const player = state.data.players[ state.data.playerId ];
	if ( !player.teamId ) {
		return null;
	}
	return state.data.teams[ player.teamId ];
} ) );

export const useOppositeTeam = () => useGameStore( useShallow( state => {
	const player = state.data.players[ state.data.playerId ];
	if ( !player.teamId ) {
		return null;
	}
	return Object.values( state.data.teams ).find( team => team.id !== player.teamId );
} ) );

export const useEventHandlers = () => useGameStore( state => state.eventHandlers );