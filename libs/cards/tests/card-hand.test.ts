import { CardHand, CardRank, CardSet, CardSuit, PlayingCard } from "@s2h/cards";

describe( "Card Hand", function () {

	it( "should serialize to plain json", function () {
		const card1 = new PlayingCard( CardRank.KING, CardSuit.DIAMONDS );
		const card2 = new PlayingCard( CardRank.ACE, CardSuit.HEARTS );
		const card3 = new PlayingCard( CardRank.QUEEN, CardSuit.CLUBS );
		const card4 = new PlayingCard( CardRank.TWO, CardSuit.SPADES );

		const hand = new CardHand( [ card1, card2, card3, card4 ] );
		const { cards } = hand.serialize();

		expect( cards[ 0 ][ "rank" ] ).toBe( "King" );
		expect( cards[ 0 ][ "suit" ] ).toBe( "Diamonds" );
		expect( cards[ 1 ][ "rank" ] ).toBe( "Ace" );
		expect( cards[ 1 ][ "suit" ] ).toBe( "Hearts" );
		expect( cards[ 2 ][ "rank" ] ).toBe( "Queen" );
		expect( cards[ 2 ][ "suit" ] ).toBe( "Clubs" );
		expect( cards[ 3 ][ "rank" ] ).toBe( "Two" );
		expect( cards[ 3 ][ "suit" ] ).toBe( "Spades" );
	} );

	it( "should create from plain json", function () {
		const cards = [
			{ rank: "Ace", suit: "Diamonds" },
			{ rank: "Jack", suit: "Clubs" },
			{ rank: "Four", suit: "Spades" },
			{ rank: "Two", suit: "Hearts" },
			{ rank: "Ten", suit: "Hearts" },
		];

		const hand = CardHand.from( { cards } );

		expect( hand.length ).toBe( cards.length );
		expect( hand.cardSuitsInHand )
			.toEqual( [ CardSuit.DIAMONDS, CardSuit.CLUBS, CardSuit.SPADES, CardSuit.HEARTS ] );
		expect( hand.cardSetsInHand ).toEqual( [
			CardSet.SMALL_DIAMONDS,
			CardSet.BIG_CLUBS,
			CardSet.SMALL_SPADES,
			CardSet.SMALL_HEARTS,
			CardSet.BIG_HEARTS
		] );
	} );

	it( "should return correct cards when checking if card present in hand", function () {
		const cards = [
			{ rank: "Ace", suit: "Diamonds" },
			{ rank: "Jack", suit: "Clubs" },
			{ rank: "Four", suit: "Spades" },
			{ rank: "Two", suit: "Hearts" },
			{ rank: "Ten", suit: "Hearts" },
		];

		const hand = CardHand.from( { cards } );

		const cardsToCheck = cards.map( PlayingCard.from );
		const cardPresent = cardsToCheck[ 0 ];
		const cardNotPresent = new PlayingCard( CardRank.ACE, CardSuit.CLUBS );

		expect( hand.contains( cardPresent ) ).toBeTruthy();
		expect( hand.contains( cardNotPresent ) ).toBeFalsy();

		expect( hand.containsAll( cardsToCheck ) ).toBeTruthy();

		expect( hand.containsSome( [ cardPresent, cardNotPresent ] ) ).toBeTruthy();
	} );

	it( "should return sorted cards when asked for sorted cards", function () {
		const cards = [
			{ rank: "Ace", suit: "Diamonds" },
			{ rank: "Jack", suit: "Clubs" },
			{ rank: "Four", suit: "Spades" },
			{ rank: "Two", suit: "Hearts" },
			{ rank: "Ten", suit: "Hearts" },
		];

		const hand = CardHand.from( { cards } );

		const sortedHand = hand.sorted();

		expect( sortedHand.get( 0 ) ).toEqual( new PlayingCard( CardRank.TWO, CardSuit.HEARTS ) );
		expect( sortedHand.get( 1 ) ).toEqual( new PlayingCard( CardRank.TEN, CardSuit.HEARTS ) );
		expect( sortedHand.get( 2 ) ).toEqual( new PlayingCard( CardRank.JACK, CardSuit.CLUBS ) );
		expect( sortedHand.get( 3 ) ).toEqual( new PlayingCard( CardRank.ACE, CardSuit.DIAMONDS ) );
		expect( sortedHand.get( 4 ) ).toEqual( new PlayingCard( CardRank.FOUR, CardSuit.SPADES ) );
	} );

	it( "should be able to remove cards based on cardSet", function () {
		const cards = [
			{ rank: "Two", suit: "Hearts" },
			{ rank: "Ten", suit: "Hearts" },
			{ rank: "Four", suit: "Hearts" }
		];

		const hand = CardHand.from( { cards } );

		const fourOfHearts = new PlayingCard( CardRank.FOUR, CardSuit.HEARTS );
		const twoOfHearts = new PlayingCard( CardRank.TWO, CardSuit.HEARTS );
		const tenOfHearts = new PlayingCard( CardRank.TEN, CardSuit.HEARTS );

		const smallHeartsInHand = hand.getCardsOfSet( CardSet.SMALL_HEARTS );
		expect( smallHeartsInHand ).toContainEqual( twoOfHearts );
		expect( smallHeartsInHand ).toContainEqual( fourOfHearts );

		hand.removeCardsOfSet( CardSet.SMALL_HEARTS );

		expect( hand.contains( twoOfHearts ) ).toBeFalsy();
		expect( hand.contains( fourOfHearts ) ).toBeFalsy();
		expect( hand.contains( tenOfHearts ) ).toBeTruthy();
	} );

	it( "should be able to add or remove individual cards", function () {
		const fourOfClubs = new PlayingCard( CardRank.FOUR, CardSuit.CLUBS );
		const twoOfHearts = new PlayingCard( CardRank.TWO, CardSuit.HEARTS );

		const hand = new CardHand( [ twoOfHearts ] );

		expect( hand.contains( twoOfHearts ) ).toBeTruthy();

		hand.addCard( fourOfClubs )
		expect( hand.contains( fourOfClubs ) ).toBeTruthy();
		expect( hand.length ).toBe( 2 );

		hand.removeCard( twoOfHearts );
		expect( hand.contains( twoOfHearts ) ).toBeFalsy();
		expect( hand.length ).toBe( 1 );
	} );

} );