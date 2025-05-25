import { getCardId, getCardSet } from "@/libs/cards/card";
import { cardSetMap, SORTED_DECK } from "@/libs/cards/constants";
import { CardRank, CardSet, CardSuit, type PlayingCard } from "@/libs/cards/types";
import { chunk, shuffle } from "@/libs/cards/utils";

export function getSetsInHand( hand: PlayingCard[] ) {
	return new Set( hand.map( getCardSet ) );
}

export function getSuitsInHand( hand: PlayingCard[] ) {
	return new Set( hand.map( card => card.suit ) );
}

export function isCardSetInHand( hand: PlayingCard[], set: CardSet ) {
	return getSetsInHand( hand ).has( set );
}

export function getCardsOfSet( hand: PlayingCard[], set: CardSet ) {
	return hand.filter( card => getCardSet( card ) === set );
}

export function getCardsOfSuit( hand: PlayingCard[], suit: CardSuit ) {
	return hand.filter( card => card.suit === suit );
}

export function getAskableCardsOfSet( hand: PlayingCard[], set: CardSet ) {
	return cardSetMap[ set ].filter( card => !hand.map( getCardId ).includes( getCardId( card ) ) );
}

export function isCardInHand( hand: PlayingCard[], card: PlayingCard ) {
	return hand.map( getCardId ).includes( getCardId( card ) );
}

export function addCardToHand( hand: PlayingCard[], card: PlayingCard ) {
	return [ ...hand, card ];
}

export function removeCardFromHand( hand: PlayingCard[], card: PlayingCard ) {
	return hand.filter( c => getCardId( c ) !== getCardId( card ) );
}

export function removeCardsFromHand( hand: PlayingCard[], cards: PlayingCard[] ) {
	return hand.filter( c => !cards.map( getCardId ).includes( getCardId( c ) ) );
}

export function getSortedHand( hand: PlayingCard[] ) {
	return SORTED_DECK.filter( card => hand.map( getCardId ).includes( getCardId( card ) ) );
}

export function getSuitGroupsFromHand( hand: PlayingCard[] ) {
	return {
		[ CardSuit.CLUBS ]: getCardsOfSuit( hand, CardSuit.CLUBS ),
		[ CardSuit.DIAMONDS ]: getCardsOfSuit( hand, CardSuit.DIAMONDS ),
		[ CardSuit.HEARTS ]: getCardsOfSuit( hand, CardSuit.HEARTS ),
		[ CardSuit.SPADES ]: getCardsOfSuit( hand, CardSuit.SPADES )
	};
}

export function generateDeck() {
	return shuffle( SORTED_DECK );
}

export function removeCardsOfRank( deck: PlayingCard[], rank: CardRank ) {
	return deck.filter( card => card.rank !== rank );
}

export function generateHands( deck: PlayingCard[], handCount: number ) {
	if ( deck.length % handCount !== 0 ) {
		return [];
	}

	const handSize = deck.length / handCount;
	return chunk( deck, handSize );
}
