import { CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";

describe( "Playing Card", function () {

	it( "should create from plain json", function () {
		const jsonCard = { rank: "Ace", suit: "Diamonds" };
		const card = PlayingCard.from( jsonCard );

		expect( card.rank ).toBe( CardRank.ACE );
		expect( card.suit ).toBe( CardSuit.DIAMONDS );
		expect( card.set ).toBe( CardSet.SMALL_DIAMONDS );
	} );

	it( "should serialize to plain json", function () {
		const card = new PlayingCard( CardRank.ACE, CardSuit.DIAMONDS );
		const serializedCard = card.serialize();

		expect( serializedCard[ "rank" ] ).toBe( "Ace" );
		expect( serializedCard[ "suit" ] ).toBe( "Diamonds" );
		expect( serializedCard[ "set" ] ).toBeUndefined()
		expect( serializedCard[ "cardString" ] ).toBeUndefined()
		expect( serializedCard[ "set" ] ).toBeUndefined()
	} );

	it( "should have correct cardString and id", function () {
		const card = new PlayingCard( CardRank.ACE, CardSuit.DIAMONDS );

		expect( card.cardString ).toBe( "Ace of Diamonds" );
		expect( card.id ).toBe( "AceOfDiamonds" );
	} );

	it( "should compute correct card set", function () {
		const card1 = new PlayingCard( CardRank.KING, CardSuit.DIAMONDS );
		const card2 = new PlayingCard( CardRank.ACE, CardSuit.DIAMONDS );
		const card3 = new PlayingCard( CardRank.QUEEN, CardSuit.CLUBS );
		const card4 = new PlayingCard( CardRank.TWO, CardSuit.CLUBS );
		const card5 = new PlayingCard( CardRank.JACK, CardSuit.SPADES );
		const card6 = new PlayingCard( CardRank.THREE, CardSuit.SPADES );
		const card7 = new PlayingCard( CardRank.TEN, CardSuit.HEARTS );
		const card8 = new PlayingCard( CardRank.FOUR, CardSuit.HEARTS );

		expect( card1.set ).toBe( CardSet.BIG_DIAMONDS );
		expect( card2.set ).toBe( CardSet.SMALL_DIAMONDS );
		expect( card3.set ).toBe( CardSet.BIG_CLUBS );
		expect( card4.set ).toBe( CardSet.SMALL_CLUBS );
		expect( card5.set ).toBe( CardSet.BIG_SPADES );
		expect( card6.set ).toBe( CardSet.SMALL_SPADES );
		expect( card7.set ).toBe( CardSet.BIG_HEARTS );
		expect( card8.set ).toBe( CardSet.SMALL_HEARTS );
	} )
} );