import { PlayingCard } from "./card.ts";
import { CardHand } from "./hand.ts";
import { CardSuit } from "./types.ts";

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
		return trumpCards.reduce( ( bestCard, card ) => card.isGreaterThan( bestCard.id ) ? card : bestCard );
	}

	if ( roundSuitCards.length > 0 ) {
		return roundSuitCards.reduce( ( bestCard, card ) => card.isGreaterThan( bestCard.id ) ? card : bestCard );
	}

	return otherCards.reduce( ( bestCard, card ) => card.isGreaterThan( bestCard.id ) ? card : bestCard );
}

export function getPlayableCards(
	hand: CardHand,
	trumpSuit: string,
	greatest?: PlayingCard,
	roundSuit?: string | null
) {
	if ( !greatest || !roundSuit ) {
		return hand.cardIds;
	}

	const cardsOfRoundSuit = hand.getCardsOfSuit( roundSuit as CardSuit );
	const trumpCards = hand.getCardsOfSuit( trumpSuit as CardSuit );

	if ( roundSuit === trumpSuit ) {
		if ( cardsOfRoundSuit.length === 0 ) {
			return hand.cardIds;
		}

		const greaterCards = cardsOfRoundSuit.filter( card => card.isGreaterThan( greatest.id ) );
		return greaterCards.length > 0
			? greaterCards.map( card => card.id )
			: cardsOfRoundSuit.map( card => card.id );
	}

	if ( cardsOfRoundSuit.length === 0 ) {

		if ( greatest.suit !== trumpSuit ) {
			return trumpCards.length > 0
				? trumpCards.map( card => card.id )
				: hand.cardIds;
		}

		const greaterTrumpCards = trumpCards.filter( card => card.isGreaterThan( greatest.id ) );
		return greaterTrumpCards.length > 0
			? greaterTrumpCards.map( card => card.id )
			: hand.cardIds;
	}

	if ( greatest.suit !== trumpSuit ) {
		const greaterCards = cardsOfRoundSuit.filter( card => card.isGreaterThan( greatest.id ) );
		console.log( greaterCards );
		return greaterCards.length > 0
			? greaterCards.map( card => card.id )
			: cardsOfRoundSuit.map( card => card.id );
	}

	return cardsOfRoundSuit.map( card => card.id );
}

export function generateGameCode() {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < 6; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}