import { CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";
import { describe, expect, it } from "vitest";

describe( "Playing Card", () => {

	it( "should serialize and deserialize correctly", () => {
		const card = PlayingCard.from( { rank: CardRank.ACE, suit: CardSuit.DIAMONDS } );
		const serializedCard = card.serialize();

		expect( serializedCard[ "rank" ] ).toBe( "Ace" );
		expect( serializedCard[ "suit" ] ).toBe( "Diamonds" );
		expect( serializedCard[ "set" ] ).toBeUndefined();
		expect( serializedCard[ "cardString" ] ).toBeUndefined();
		expect( serializedCard[ "set" ] ).toBeUndefined();

		const deserializedCard = PlayingCard.from( serializedCard );

		expect( deserializedCard.rank ).toBe( CardRank.ACE );
		expect( deserializedCard.suit ).toBe( CardSuit.DIAMONDS );
		expect( deserializedCard.set ).toBe( CardSet.SMALL_DIAMONDS );
	} );

	it( "should have correct cardString and id", () => {
		const card = PlayingCard.from( { rank: CardRank.ACE, suit: CardSuit.DIAMONDS } );

		expect( card.cardString ).toBe( "Ace of Diamonds" );
		expect( card.id ).toBe( "AceOfDiamonds" );
	} );

	it( "should compute correct card set", () => {
		const card1 = PlayingCard.from( { rank: CardRank.KING, suit: CardSuit.DIAMONDS } );
		const card2 = PlayingCard.from( { rank: CardRank.ACE, suit: CardSuit.DIAMONDS } );
		const card3 = PlayingCard.from( { rank: CardRank.QUEEN, suit: CardSuit.CLUBS } );
		const card4 = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.CLUBS } );
		const card5 = PlayingCard.from( { rank: CardRank.JACK, suit: CardSuit.SPADES } );
		const card6 = PlayingCard.from( { rank: CardRank.THREE, suit: CardSuit.SPADES } );
		const card7 = PlayingCard.from( { rank: CardRank.TEN, suit: CardSuit.HEARTS } );
		const card8 = PlayingCard.from( { rank: CardRank.FOUR, suit: CardSuit.HEARTS } );

		expect( card1.set ).toBe( CardSet.BIG_DIAMONDS );
		expect( card2.set ).toBe( CardSet.SMALL_DIAMONDS );
		expect( card3.set ).toBe( CardSet.BIG_CLUBS );
		expect( card4.set ).toBe( CardSet.SMALL_CLUBS );
		expect( card5.set ).toBe( CardSet.BIG_SPADES );
		expect( card6.set ).toBe( CardSet.SMALL_SPADES );
		expect( card7.set ).toBe( CardSet.BIG_HEARTS );
		expect( card8.set ).toBe( CardSet.SMALL_HEARTS );
	} );
} );