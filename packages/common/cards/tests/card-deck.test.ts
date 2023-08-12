import { CardDeck, CardRank, SORTED_DECK } from "../src";
import { describe, expect, it } from "vitest";

describe( "Card Deck", () => {

	it( "should be able to remove cards of rank", () => {
		const deck = new CardDeck();

		expect( deck.length ).toBe( 52 );

		deck.removeCardsOfRank( CardRank.TEN );
		expect( deck.length ).toBe( 48 );

		deck.removeCardsOfRank( CardRank.NINE );
		expect( deck.length ).toBe( 44 );

		deck.removeCardsOfRank( CardRank.NINE );
		expect( deck.length ).toBe( 44 );

	} );

	it( "should be able to generate specified number of hands", () => {
		const deck = new CardDeck();

		const hands = deck.generateHands( 4 );
		expect( hands.length ).toBe( 4 );
		expect( hands[ 0 ].length ).toBe( 13 );
	} );

	it( "should return no hands if same hand size is not possible", () => {
		const deck = new CardDeck();
		const hands = deck.generateHands( 5 );
		expect( hands.length ).toBe( 0 );
	} );

	it( "should be able to return sorted deck", () => {
		const deck = new CardDeck();
		deck.sort();
		expect( deck.cards ).toEqual( SORTED_DECK );
	} );

} );