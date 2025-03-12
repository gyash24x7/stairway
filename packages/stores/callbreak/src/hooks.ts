import { getBestCardPlayed, getCardFromId, getPlayableCards } from "@stairway/cards";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "./store";

export const useGameId = () => useGameStore( state => state.data.game.id );

export const useCurrentDealId = () => useGameStore( state => state.data.currentDeal?.id );

export const useCurrentRoundId = () => useGameStore( state => state.data.currentRound?.id );

export const useGameCode = () => useGameStore( state => state.data.game.code );

export const usePlayerId = () => useGameStore( state => state.data.playerId );

export const usePlayers = () => useGameStore( state => state.data.players );

export const usePlayerList = () => useGameStore( useShallow( state => {
	return Object.values( state.data.players ).toSorted( ( a, b ) => a.id.localeCompare( b.id ) );
} ) );

export const useGameStatus = () => useGameStore( state => state.data.game.status );

export const useHand = () => useGameStore( state => state.data.hand );

export const useScoreList = () => useGameStore( state => state.data.game.scores );

export const useScoresAggregate = () => useGameStore( useShallow( state => {
	const aggregate: Record<string, number> = {};
	state.data.game.scores.forEach( score => {
		Object.entries( score ).forEach( ( [ playerId, playerScore ] ) => {
			aggregate[ playerId ] = ( aggregate[ playerId ] ?? 0 ) + playerScore;
		} );
	} );
	return aggregate;
} ) );

export const useCurrentDeal = () => useGameStore( state => state.data.currentDeal );

export const useCurrentRound = () => useGameStore( state => state.data.currentRound );

export const usePlayableCardsForCurrentRound = () => useGameStore( useShallow( state => {
	const roundSuit = state.data.currentRound?.suit;
	const trumpSuit = state.data.game.trumpSuit;
	const cardsPlayed = Object.values( state.data.currentRound?.cards ?? {} ).map( getCardFromId );
	const hand = state.data.hand;

	const bestCardPlayed = getBestCardPlayed( cardsPlayed ?? [], trumpSuit, roundSuit );
	return getPlayableCards( hand, trumpSuit, bestCardPlayed, roundSuit );
} ) );

export const useEventHandlers = () => useGameStore( state => state.eventHandlers );