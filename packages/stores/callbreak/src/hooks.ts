import type { Player } from "@stairway/api/callbreak";
import { getBestCardPlayed, getCardFromId, getPlayableCards } from "@stairway/cards";
import { callbreak$ } from "./store.ts";

const sortById = ( a: Player, b: Player ) => a.id.localeCompare( b.id );

export const useGameId = () => callbreak$.data.game.id.get();
export const useCurrentDealId = () => callbreak$.data.currentDeal.get()?.id;
export const useCurrentRoundId = () => callbreak$.data.currentRound.get()?.id;
export const useGameCode = () => callbreak$.data.game.code.get();
export const usePlayerId = () => callbreak$.data.playerId.get();
export const usePlayers = () => callbreak$.data.players.get();
export const usePlayerList = () => Object.values( callbreak$.data.players.get() ).toSorted( sortById );
export const useGameStatus = () => callbreak$.data.game.status.get();
export const useHand = () => callbreak$.data.hand.get();
export const useScoreList = () => callbreak$.data.game.scores.get();
export const useScoresAggregate = () => {
	const aggregate: Record<string, number> = {};
	callbreak$.data.game.scores.get().forEach( score => {
		Object.entries( score ).forEach( ( [ playerId, playerScore ] ) => {
			aggregate[ playerId ] = ( aggregate[ playerId ] ?? 0 ) + playerScore;
		} );
	} );
	return aggregate;
};
export const useCurrentDeal = () => callbreak$.data.currentDeal.get();
export const useCurrentRound = () => callbreak$.data.currentRound.get();

export const usePlayableCardsForCurrentRound = () => {
	const currentRound = callbreak$.data.currentRound.get();
	const roundSuit = currentRound?.suit;
	const trumpSuit = callbreak$.data.game.trumpSuit.get();
	const cardsPlayed = Object.values( currentRound?.cards ?? {} ).map( getCardFromId );
	const hand = callbreak$.data.hand.get();

	const bestCardPlayed = getBestCardPlayed( cardsPlayed ?? [], trumpSuit, roundSuit );
	return getPlayableCards( hand, trumpSuit, bestCardPlayed, roundSuit );
};

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

export const useGameEventHandlers = () => {
	return {
		[ GameEvents.PLAYER_JOINED ]: callbreak$.eventHandlers.handlePlayerJoinedEvent,
		[ GameEvents.ALL_PLAYER_JOINED ]: callbreak$.eventHandlers.handleAllPlayersJoinedEvent,
		[ GameEvents.DEAL_CREATED ]: callbreak$.eventHandlers.handleDealCreatedEvent,
		[ GameEvents.DEAL_WIN_DECLARED ]: callbreak$.eventHandlers.handleDealWinDeclaredEvent,
		[ GameEvents.ALL_DEAL_WINS_DECLARED ]: callbreak$.eventHandlers.handleAllDealWinsDeclaredEvent,
		[ GameEvents.ROUND_CREATED ]: callbreak$.eventHandlers.handleRoundCreatedEvent,
		[ GameEvents.CARD_PLAYED ]: callbreak$.eventHandlers.handleCardPlayedEvent,
		[ GameEvents.ROUND_COMPLETED ]: callbreak$.eventHandlers.handleRoundCompletedEvent,
		[ GameEvents.DEAL_COMPLETED ]: callbreak$.eventHandlers.handleDealCompletedEvent,
		[ GameEvents.STATUS_UPDATED ]: callbreak$.eventHandlers.handleStatusUpdatedEvent,
		[ GameEvents.GAME_COMPLETED ]: callbreak$.eventHandlers.handleGameCompletedEvent
	};
};

export const usePlayerSpecificEventHandlers = () => {
	return {
		[ PlayerSpecificEvents.CARDS_DEALT ]: callbreak$.eventHandlers.handleCardsDealtEvent
	};
};