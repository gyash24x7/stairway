import { CardHand, CardRank, CardSet, CardSuit, IPlayingCard, PlayingCard } from "@s2h/cards";

describe( "Card Hand", function () {

    it( "should serialize and deserialize correctly", function () {
        const card1 = PlayingCard.from( { rank: CardRank.KING, suit: CardSuit.DIAMONDS } );
        const card2 = PlayingCard.from( { rank: CardRank.ACE, suit: CardSuit.HEARTS } );
        const card3 = PlayingCard.from( { rank: CardRank.QUEEN, suit: CardSuit.CLUBS } );
        const card4 = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.SPADES } );

        const hand = CardHand.from( { cards: [ card1, card2, card3, card4 ] } );
        const serializedHand = hand.serialize();

        expect( hand.map( c => c.id ) ).toEqual( [ card1.id, card2.id, card3.id, card4.id ] );

        expect( serializedHand.cards[ 0 ][ "rank" ] ).toBe( "King" );
        expect( serializedHand.cards[ 0 ][ "suit" ] ).toBe( "Diamonds" );
        expect( serializedHand.cards[ 1 ][ "rank" ] ).toBe( "Ace" );
        expect( serializedHand.cards[ 1 ][ "suit" ] ).toBe( "Hearts" );
        expect( serializedHand.cards[ 2 ][ "rank" ] ).toBe( "Queen" );
        expect( serializedHand.cards[ 2 ][ "suit" ] ).toBe( "Clubs" );
        expect( serializedHand.cards[ 3 ][ "rank" ] ).toBe( "Two" );
        expect( serializedHand.cards[ 3 ][ "suit" ] ).toBe( "Spades" );

        const deserializedHand = CardHand.from( serializedHand );

        expect( deserializedHand.length ).toBe( serializedHand.cards.length );
        expect( deserializedHand.cardSuitsInHand )
            .toEqual( [ CardSuit.DIAMONDS, CardSuit.HEARTS, CardSuit.CLUBS, CardSuit.SPADES ] );
        expect( deserializedHand.cardSetsInHand ).toEqual( [
            CardSet.BIG_DIAMONDS,
            CardSet.SMALL_HEARTS,
            CardSet.BIG_CLUBS,
            CardSet.SMALL_SPADES
        ] );
    } );

    it( "should return correct cards when checking if card present in hand", function () {
        const cards: IPlayingCard[] = JSON.parse( JSON.stringify( [
            { rank: "Ace", suit: "Diamonds" },
            { rank: "Jack", suit: "Clubs" },
            { rank: "Four", suit: "Spades" },
            { rank: "Two", suit: "Hearts" },
            { rank: "Ten", suit: "Hearts" },
        ] ) );

        const hand = CardHand.from( { cards } );

        const cardsToCheck = cards.map( PlayingCard.from );
        const cardPresent = cardsToCheck[ 0 ];
        const cardNotPresent = PlayingCard.from( { rank: CardRank.ACE, suit: CardSuit.CLUBS } );

        expect( hand.contains( cardPresent ) ).toBeTruthy();
        expect( hand.contains( cardNotPresent ) ).toBeFalsy();

        expect( hand.containsAll( cardsToCheck ) ).toBeTruthy();

        expect( hand.containsSome( [ cardPresent, cardNotPresent ] ) ).toBeTruthy();
    } );

    it( "should return sorted cards when asked for sorted cards", function () {
        const cards: IPlayingCard[] = JSON.parse( JSON.stringify( [
            { rank: "Ace", suit: "Diamonds" },
            { rank: "Jack", suit: "Clubs" },
            { rank: "Four", suit: "Spades" },
            { rank: "Two", suit: "Hearts" },
            { rank: "Ten", suit: "Hearts" },
        ] ) );

        const hand = CardHand.from( { cards } );

        const sortedHand = hand.sorted();

        expect( sortedHand.get( 0 ) ).toEqual( PlayingCard.from( {
            rank: CardRank.TWO,
            suit: CardSuit.HEARTS
        } ) );
        expect( sortedHand.get( 1 ) ).toEqual( PlayingCard.from( {
            rank: CardRank.TEN,
            suit: CardSuit.HEARTS
        } ) );
        expect( sortedHand.get( 2 ) ).toEqual( PlayingCard.from( {
            rank: CardRank.JACK,
            suit: CardSuit.CLUBS
        } ) );
        expect( sortedHand.get( 3 ) ).toEqual( PlayingCard.from( {
            rank: CardRank.ACE,
            suit: CardSuit.DIAMONDS
        } ) );
        expect( sortedHand.get( 4 ) ).toEqual( PlayingCard.from( {
            rank: CardRank.FOUR,
            suit: CardSuit.SPADES
        } ) );
    } );

    it( "should be able to remove cards based on cardSet", function () {
        const fourOfHearts = PlayingCard.from( { rank: CardRank.FOUR, suit: CardSuit.HEARTS } );
        const twoOfHearts = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.HEARTS } );
        const tenOfHearts = PlayingCard.from( { rank: CardRank.TEN, suit: CardSuit.HEARTS } );

        const hand = CardHand.from( { cards: [ twoOfHearts, fourOfHearts, tenOfHearts ] } );

        const smallHeartsInHand = hand.getCardsOfSet( CardSet.SMALL_HEARTS );
        expect( smallHeartsInHand ).toContainEqual( twoOfHearts );
        expect( smallHeartsInHand ).toContainEqual( fourOfHearts );

        hand.removeCardsOfSet( CardSet.SMALL_HEARTS );

        expect( hand.contains( twoOfHearts ) ).toBeFalsy();
        expect( hand.contains( fourOfHearts ) ).toBeFalsy();
        expect( hand.contains( tenOfHearts ) ).toBeTruthy();
    } );

    it( "should be able to add or remove individual cards", function () {
        const fourOfClubs = PlayingCard.from( { rank: CardRank.FOUR, suit: CardSuit.CLUBS } );
        const twoOfHearts = PlayingCard.from( { rank: CardRank.TWO, suit: CardSuit.HEARTS } );

        const hand = CardHand.from( { cards: [ twoOfHearts ] } );

        expect( hand.contains( twoOfHearts ) ).toBeTruthy();

        hand.addCard( fourOfClubs )
        expect( hand.contains( fourOfClubs ) ).toBeTruthy();
        expect( hand.length ).toBe( 2 );

        hand.removeCard( twoOfHearts );
        expect( hand.contains( twoOfHearts ) ).toBeFalsy();
        expect( hand.length ).toBe( 1 );
    } );

} );