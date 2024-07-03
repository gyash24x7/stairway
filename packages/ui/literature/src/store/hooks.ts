import type { Router as LiteratureRouter } from "@backend/literature";
import { trpcLink } from "@shared/ui";
import { createTRPCReact } from "@trpc/react-query";
import { useLiteratureStore } from "./store";

export const useGameId = () => useLiteratureStore( state => state.data.gameData.id );
export const usePlayerCount = () => useLiteratureStore( state => state.data.gameData.playerCount );
export const useGameCode = () => useLiteratureStore( state => state.data.gameData.code );
export const usePlayerId = () => useLiteratureStore( state => state.data.playerId );
export const usePlayers = () => useLiteratureStore( state => state.data.gameData.players );
export const useTeams = () => useLiteratureStore( state => state.data.gameData.teams );
export const useGameStatus = () => useLiteratureStore( state => state.data.gameData.status );
export const useCurrentTurn = () => useLiteratureStore( state => state.data.gameData.currentTurn );
export const useHand = () => useLiteratureStore( state => state.data.hand );
export const useLastMove = () => useLiteratureStore( state => state.data.gameData.moves[ 0 ] );
export const useCardSetsInHand = () => useLiteratureStore( state => state.data.hand.sets );
export const useCardCounts = () => useLiteratureStore( state => state.data.gameData.cardCounts );
export const useMoves = () => useLiteratureStore( state => state.data.gameData.moves.slice( 0, 5 ) );

export const useMyTeam = () => useLiteratureStore( state => {
	const player = state.data.gameData.players[ state.data.playerId ];
	if ( !player.teamId ) {
		return null;
	}
	return state.data.gameData.teams[ player.teamId ];
} );

export const useOppositeTeam = () => useLiteratureStore( state => {
	const player = state.data.gameData.players[ state.data.playerId ];
	if ( !player.teamId ) {
		return null;
	}
	return Object.values( state.data.gameData.teams ).find( team => team.id !== player.teamId );
} );


export const LiteratureTrpc = createTRPCReact<LiteratureRouter>();
export const literatureTrpcClient = LiteratureTrpc.createClient( { links: [ trpcLink( "literature" ) ] } );

export const useCreateGameMutation = () => LiteratureTrpc.createGame.useMutation();
export const useJoinGameMutation = () => LiteratureTrpc.joinGame.useMutation();
export const useAddBotsMutation = () => LiteratureTrpc.addBots.useMutation();
export const useCreateTeamsMutation = () => LiteratureTrpc.createTeams.useMutation();
export const useStartGameMutation = () => LiteratureTrpc.startGame.useMutation();
export const useAskCardMutation = () => LiteratureTrpc.askCard.useMutation();
export const useCallSetMutation = () => LiteratureTrpc.callSet.useMutation();
export const useTransferTurnMutation = () => LiteratureTrpc.transferTurn.useMutation();
export const useExecuteBotMoveMutation = () => LiteratureTrpc.executeBotMove.useMutation();

export const useGetGameDataQuery = ( gameId: string ) => LiteratureTrpc.getGameData.useQuery( { gameId } );

const GameEvents = {
	PLAYER_JOINED: "player-joined",
	TEAMS_CREATED: "teams-created",
	MOVE_CREATED: "move-created",
	TURN_UPDATED: "turn-updated",
	SCORE_UPDATED: "score-updated",
	STATUS_UPDATED: "status-updated",
	CARD_COUNT_UPDATED: "card-count-updated",
	GAME_COMPLETED: "game-completed"
};

const PlayerSpecificEvents = {
	HAND_UPDATED: "hand-updated",
	CARD_LOCATIONS_UPDATED: "card-locations-updated"
};

export const useGameEventHandlers = () => useLiteratureStore( state => {
	return {
		[ GameEvents.PLAYER_JOINED ]: state.eventHandlers.handlePlayerJoinedEvent,
		[ GameEvents.TEAMS_CREATED ]: state.eventHandlers.handleTeamsCreatedEvent,
		[ GameEvents.MOVE_CREATED ]: state.eventHandlers.handleMoveCreatedEvent,
		[ GameEvents.TURN_UPDATED ]: state.eventHandlers.handleTurnUpdatedEvent,
		[ GameEvents.SCORE_UPDATED ]: state.eventHandlers.handleScoreUpdatedEvent,
		[ GameEvents.STATUS_UPDATED ]: state.eventHandlers.handleStatusUpdatedEvent,
		[ GameEvents.CARD_COUNT_UPDATED ]: state.eventHandlers.handleCardCountsUpdatedEvent,
		[ GameEvents.GAME_COMPLETED ]: state.eventHandlers.handleGameCompletedEvent
	};
} );

export const usePlayerSpecificEventHandlers = () => useLiteratureStore( state => {
	return {
		[ PlayerSpecificEvents.HAND_UPDATED ]: state.eventHandlers.handleHandUpdatedEvent,
		[ PlayerSpecificEvents.CARD_LOCATIONS_UPDATED ]: state.eventHandlers.handleCardLocationsUpdatedEvent
	};
} );