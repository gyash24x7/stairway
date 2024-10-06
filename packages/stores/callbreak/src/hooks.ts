import type { Player } from "@callbreak/api";
import { getBestCardPlayed, getPlayableCards, PlayingCard } from "@stairway/cards";
import { useGameStore } from "./store.ts";

const sortById = ( a: Player, b: Player ) => a.id.localeCompare( b.id );

export const useGameId = () => useGameStore( state => state.data.game.id );
export const useDealId = () => useGameStore( state => state.data.deals[ 0 ]?.id );
export const useRoundId = () => useGameStore( state => state.data.deals[ 0 ]?.rounds[ 0 ]?.id );
export const useGameCode = () => useGameStore( state => state.data.game.code );
export const usePlayerId = () => useGameStore( state => state.data.playerId );
export const usePlayers = () => useGameStore( state => state.data.players );
export const usePlayerList = () => useGameStore( state => Object.values( state.data.players ).toSorted( sortById ) );
export const useGameStatus = () => useGameStore( state => state.data.game.status );
export const useHand = () => useGameStore( state => state.data.hand );
export const useScoreList = () => useGameStore( state => state.data.game.scores );
export const useScoresAggregate = () => useGameStore( state => {
	const aggregate: Record<string, number> = {};
	state.data.game.scores.forEach( score => {
		Object.entries( score ).forEach( ( [ playerId, playerScore ] ) => {
			aggregate[ playerId ] = ( aggregate[ playerId ] ?? 0 ) + playerScore;
		} );
	} );
	return aggregate;
} );
export const useDeal = () => useGameStore( state => state.data.deals[ 0 ] );
export const useRound = () => useGameStore( state => state.data.deals[ 0 ]?.rounds[ 0 ] );

export const usePlayableCardsForCurrentRound = () => useGameStore( state => {
	const roundSuit = state.data.deals[ 0 ]?.rounds[ 0 ]?.suit;
	const trumpSuit = state.data.game.trumpSuit;
	const cardsPlayed = Object.values( state.data.deals[ 0 ]?.rounds[ 0 ]?.cards ?? {} ).map( PlayingCard.fromId );
	const hand = state.data.hand;

	const bestCardPlayed = getBestCardPlayed( cardsPlayed ?? [], trumpSuit, roundSuit );
	return getPlayableCards( hand, trumpSuit, bestCardPlayed, roundSuit );
} );

const GameEvents = {
	PLAYER_JOINED: "player-joined",
	ALL_PLAYER_JOINED: "all-players-joined",
	DEAL_CREATED: "deal-created",
	DEAL_WIN_DECLARED: "deal-win-declared",
	ALL_DEAL_WINS_DECLARED: "all-deal-wins-declared",
	ROUND_CREATED: "round-created",
	CARD_PLAYED: "card-played",
	ROUND_COMPLETED: "round-completed",
	DEAL_COMPLETED: "deal-completed",
	STATUS_UPDATED: "status-updated",
	GAME_COMPLETED: "game-completed"
};

const PlayerSpecificEvents = {
	CARDS_DEALT: "cards-dealt"
};

export const useGameEventHandlers = () => useGameStore( state => {
	return {
		[ GameEvents.PLAYER_JOINED ]: state.eventHandlers.handlePlayerJoinedEvent,
		[ GameEvents.ALL_PLAYER_JOINED ]: state.eventHandlers.handleAllPlayersJoinedEvent,
		[ GameEvents.DEAL_CREATED ]: state.eventHandlers.handleDealCreatedEvent,
		[ GameEvents.DEAL_WIN_DECLARED ]: state.eventHandlers.handleDealWinDeclaredEvent,
		[ GameEvents.ALL_DEAL_WINS_DECLARED ]: state.eventHandlers.handleAllDealWinsDeclaredEvent,
		[ GameEvents.ROUND_CREATED ]: state.eventHandlers.handleRoundCreatedEvent,
		[ GameEvents.CARD_PLAYED ]: state.eventHandlers.handleCardPlayedEvent,
		[ GameEvents.ROUND_COMPLETED ]: state.eventHandlers.handleRoundCompletedEvent,
		[ GameEvents.DEAL_COMPLETED ]: state.eventHandlers.handleDealCompletedEvent,
		[ GameEvents.STATUS_UPDATED ]: state.eventHandlers.handleStatusUpdatedEvent,
		[ GameEvents.GAME_COMPLETED ]: state.eventHandlers.handleGameCompletedEvent
	};
} );

export const usePlayerSpecificEventHandlers = () => useGameStore( state => {
	return {
		[ PlayerSpecificEvents.CARDS_DEALT ]: state.eventHandlers.handleCardsDealtEvent
	};
} );