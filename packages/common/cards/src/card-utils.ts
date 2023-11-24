import type { CardSet } from "./card-const";
import { CardRank, cardSetMap, SORTED_DECK } from "./card-const";
import type { PlayingCard } from "./playing-card";

export function shuffle<T>( arr: T[] ): T[] {
	return arr
		.map( value => {
			return { value, sort: Math.random() };
		} )
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

export function generateGameCode() {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < 6; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}

export function removeCardsOfRank( cards: PlayingCard[], rank: CardRank ) {
	return cards.filter( card => card.rank !== rank );
}

export function generateHandsFromCards( cards: PlayingCard[], handCount: number ) {
	if ( cards.length % handCount !== 0 ) {
		return [];
	}

	const handSize = cards.length / handCount;
	return chunk( cards, handSize );
}

export function isCardSetInHand( cards: PlayingCard[], set: CardSet ) {
	return getCardSetsInHand( cards ).includes( set );
}

export function getCardSetsInHand( cards: PlayingCard[] ): CardSet[] {
	return Array.from( new Set( cards.map( card => card.set ) ) );
}

export function getCardsOfSet( cards: PlayingCard[], set: CardSet ): PlayingCard[] {
	return cards.filter( card => card.set === set );
}

export function getAskableCardsOfSet( cards: PlayingCard[], set: CardSet ): PlayingCard[] {
	return cardSetMap[ set ].filter( card => !cards.map( c => c.id ).includes( card.id ) );
}

export function sortCards( cards: PlayingCard[] ) {
	const cardIds = cards.map( card => card.id );
	return SORTED_DECK.filter( card => cardIds.includes( card.id ) );
}
