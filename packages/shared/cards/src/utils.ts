import { compareCards } from "./card";
import { getCardsOfSuit } from "./hand";
import { CardSuit, type PlayingCard } from "./types";

export function shuffle<T>( arr: T[] ): T[] {
	return arr
		.map( value => (
			{ value, sort: Math.random() }
		) )
		.sort( ( a, b ) => a.sort - b.sort )
		.map( ( { value } ) => value );
}

export function chunk<T>( arr: T[], size: number ): T[][] {
	const chunks: T[][] = [];

	for ( let i = 0; i < arr.length; i += size ) {
		const chunk = arr.slice( i, i + size );
		chunks.push( chunk );
	}

	return chunks;
}

export function getBestCardPlayed( cardsPlayed: PlayingCard[], trumpSuit: string, roundSuit?: string | null ) {
	if ( cardsPlayed.length === 0 || !roundSuit ) {
		return undefined;
	}

	const trumpCards = cardsPlayed.filter( card => card.suit === trumpSuit );
	const roundSuitCards = cardsPlayed.filter( card => card.suit === roundSuit );
	const otherCards = cardsPlayed.filter( card => card.suit !== trumpSuit && card.suit !== roundSuit );

	if ( trumpCards.length > 0 ) {
		return trumpCards.reduce( ( bestCard, card ) => compareCards( card, bestCard ) ? card : bestCard );
	}

	if ( roundSuitCards.length > 0 ) {
		return roundSuitCards.reduce( ( bestCard, card ) => compareCards( card, bestCard ) ? card : bestCard );
	}

	return otherCards.reduce( ( bestCard, card ) => compareCards( card, bestCard ) ? card : bestCard );
}

export function getPlayableCards(
	hand: PlayingCard[],
	trumpSuit: string,
	greatest?: PlayingCard,
	roundSuit?: string | null
) {
	if ( !greatest || !roundSuit ) {
		return hand;
	}

	const cardsOfRoundSuit = getCardsOfSuit( hand, roundSuit as CardSuit );
	const trumpCards = getCardsOfSuit( hand, trumpSuit as CardSuit );

	if ( roundSuit === trumpSuit ) {
		if ( cardsOfRoundSuit.length === 0 ) {
			return hand;
		}

		const greaterCards = cardsOfRoundSuit.filter( card => compareCards( card, greatest ) );
		return greaterCards.length > 0 ? greaterCards : cardsOfRoundSuit;
	}

	if ( cardsOfRoundSuit.length === 0 ) {

		if ( greatest.suit !== trumpSuit ) {
			return trumpCards.length > 0 ? trumpCards : hand;
		}

		const greaterTrumpCards = trumpCards.filter( card => compareCards( card, greatest ) );
		return greaterTrumpCards.length > 0 ? greaterTrumpCards : hand;
	}

	if ( greatest.suit !== trumpSuit ) {
		const greaterCards = cardsOfRoundSuit.filter( card => compareCards( card, greatest ) );
		return greaterCards.length > 0 ? greaterCards : cardsOfRoundSuit;
	}

	return cardsOfRoundSuit;
}