import { CardDeck, CardRank } from "@s2h/cards";

describe( "Card Deck", function () {

	it( "should be able to remove cards of rank", function () {
		const deck = new CardDeck();

		expect( deck.length ).toBe( 52 );

		deck.removeCardsOfRank( CardRank.TEN );
		expect( deck.length ).toBe( 48 );

		deck.removeCardsOfRank( CardRank.NINE );
		expect( deck.length ).toBe( 44 );

		deck.removeCardsOfRank( CardRank.NINE );
		expect( deck.length ).toBe( 44 );

	} );

	it( "should be able to generate specified number of hands", function () {
		const deck = new CardDeck();

		const hands = deck.generateHands( 4 );
		expect( hands.length ).toBe( 4 );
		expect( hands[ 0 ].length ).toBe( 13 );
	} );

} );