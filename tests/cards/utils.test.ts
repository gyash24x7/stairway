import { CARD_RANKS, CARD_SETS, CARD_SUITS, SORTED_DECK } from "@/libs/cards/constants";
import type { PlayingCard } from "@/libs/cards/types";
import * as utils from "@/libs/cards/utils";
import { canCardBePlayed, getBestCardPlayed, getPlayableCards } from "@/libs/cards/utils";

const aceHearts = { rank: CARD_RANKS.ACE, suit: CARD_SUITS.HEARTS };
const kingHearts = { rank: CARD_RANKS.KING, suit: CARD_SUITS.HEARTS };
const queenHearts = { rank: CARD_RANKS.QUEEN, suit: CARD_SUITS.HEARTS };
const aceClubs = { rank: CARD_RANKS.ACE, suit: CARD_SUITS.CLUBS };
const kingClubs = { rank: CARD_RANKS.KING, suit: CARD_SUITS.CLUBS };
const queenClubs = { rank: CARD_RANKS.QUEEN, suit: CARD_SUITS.CLUBS };
const kingSpades = { rank: CARD_RANKS.KING, suit: CARD_SUITS.SPADES };
const queenSpades = { rank: CARD_RANKS.QUEEN, suit: CARD_SUITS.SPADES };
const aceSpades = { rank: CARD_RANKS.ACE, suit: CARD_SUITS.SPADES };

const hand: PlayingCard[] = [ aceHearts, kingHearts, aceClubs, kingClubs ];

describe( "getCardId", () => {
	it( "returns correct id for a card", () => {
		expect( utils.getCardId( aceHearts ) ).toBe( "AH" );
		expect( utils.getCardId( kingClubs ) ).toBe( "KC" );
	} );
} );

describe( "getCardDisplayString", () => {
	it( "returns display string for PlayingCard", () => {
		expect( utils.getCardDisplayString( aceHearts ) ).toContain( "A" );
		expect( utils.getCardDisplayString( aceHearts ) ).toContain( "H" );
	} );
	it( "returns display string for CardId", () => {
		expect( utils.getCardDisplayString( "AH" ) ).toContain( "A" );
		expect( utils.getCardDisplayString( "KC" ) ).toContain( "K" );
	} );
} );

describe( "getCardSuit", () => {
	it( "returns suit from PlayingCard", () => {
		expect( utils.getCardSuit( aceHearts ) ).toBe( "H" );
	} );
	it( "returns suit from CardId", () => {
		expect( utils.getCardSuit( "KC" ) ).toBe( "C" );
	} );
} );

describe( "getCardSet", () => {
	it( "returns correct set for upper/lower", () => {
		expect( utils.getCardSet( aceHearts ) ).toBe( CARD_SETS.LOWER_HEARTS );
		expect( utils.getCardSet( "KC" ) ).toBe( CARD_SETS.UPPER_CLUBS );
	} );
} );

describe( "compareCards", () => {
	it( "returns true if first card is greater", () => {
		expect( utils.compareCards( aceHearts, kingHearts ) ).toBe( true );
		expect( utils.compareCards( kingHearts, queenHearts ) ).toBe( true );
	} );
	it( "returns false if suits differ", () => {
		expect( utils.compareCards( aceHearts, aceClubs ) ).toBe( false );
	} );
	it( "returns false if second card is ace", () => {
		expect( utils.compareCards( kingHearts, aceHearts ) ).toBe( false );
	} );
} );

describe( "getCardFromId", () => {
	it( "parses CardId to PlayingCard", () => {
		expect( utils.getCardFromId( "AH" ) ).toEqual( aceHearts );
		expect( utils.getCardFromId( "KC" ) ).toEqual( kingClubs );
	} );
} );

describe( "getCardsOfSuit", () => {
	it( "filters cards by suit", () => {
		expect( utils.getCardsOfSuit( "H", hand ) ).toEqual( [ aceHearts, kingHearts ] );
	} );

	it( "filters cards by suit", () => {
		expect( utils.getCardsOfSuit( "H" ) ).toEqual( SORTED_DECK.filter( card => card.suit === "H" ) );
	} );
} );

describe( "getCardsOfSet", () => {
	it( "filters cards by set", () => {
		expect( utils.getCardsOfSet( CARD_SETS.UPPER_HEARTS, hand ) ).toContainEqual( kingHearts );
	} );
} );

describe( "getSetsInHand", () => {
	it( "returns unique sets in hand", () => {
		expect( utils.getSetsInHand( hand ) ).toContain( CARD_SETS.UPPER_HEARTS );
		expect( utils.getSetsInHand( hand ) ).toContain( CARD_SETS.UPPER_CLUBS );
	} );
} );

describe( "getSuitsInHand", () => {
	it( "returns unique suits in hand", () => {
		expect( utils.getSuitsInHand( hand ) ).toEqual( new Set( [ "H", "C" ] ) );
	} );
} );

describe( "isCardSetInHand", () => {
	it( "checks if set is in hand", () => {
		expect( utils.isCardSetInHand( hand, CARD_SETS.UPPER_HEARTS ) ).toBe( true );
		expect( utils.isCardSetInHand( hand, CARD_SETS.LOWER_DIAMONDS ) ).toBe( false );
	} );
} );

describe( "getAskableCardsOfSet", () => {
	it( "returns cards of set not in hand", () => {
		const askable = utils.getAskableCardsOfSet( hand, CARD_SETS.UPPER_HEARTS );
		expect( askable.every( card => card.suit === "H" ) ).toBe( true );
		expect( askable ).not.toContainEqual( aceHearts );
		expect( askable ).not.toContainEqual( kingHearts );
	} );

	it( "returns empty array if hand has all cards of set", () => {
		const allUpperHearts = utils.getCardsOfSet( CARD_SETS.UPPER_HEARTS );
		expect( utils.getAskableCardsOfSet( allUpperHearts, CARD_SETS.UPPER_HEARTS ) ).toEqual( [] );
	} );
} );

describe( "isCardInHand", () => {
	it( "checks if card is in hand", () => {
		expect( utils.isCardInHand( hand, aceHearts ) ).toBe( true );
		expect( utils.isCardInHand( hand, "AH" ) ).toBe( true );
		expect( utils.isCardInHand( hand, "QS" ) ).toBe( false );
	} );
} );

describe( "getSortedHand", () => {
	it( "returns hand sorted as per deck", () => {
		const sorted = utils.getSortedHand( hand );
		expect( sorted.length ).toBe( hand.length );
		expect( sorted[ 0 ] ).toEqual( aceClubs );
	} );
} );

describe( "generateDeck", () => {
	it( "returns a shuffled deck", () => {
		const deck = utils.generateDeck();
		expect( deck.length ).toBeGreaterThan( 0 );
		expect( deck.some( card => card.rank === "A" ) ).toBe( true );
	} );
} );

describe( "generateHands", () => {
	it( "splits deck into hands", () => {
		const deck = [ ...hand, ...hand ];
		const hands = utils.generateHands( deck, 2 );
		expect( hands.length ).toBe( 2 );
		expect( hands[ 0 ].length ).toBe( deck.length / 2 );
	} );
	it( "returns empty array if not divisible", () => {
		expect( utils.generateHands( hand, 3 ) ).toEqual( [] );
	} );
} );

describe( "removeCards", () => {
	it( "removes cards matching predicate", () => {
		const result = utils.removeCards( card => card.suit === "H", hand );
		expect( result.every( card => card.suit !== "H" ) ).toBe( true );
	} );

	it( "removes cards matching predicate", () => {
		const result = utils.removeCards( card => card.suit === "H" );
		expect( result.every( card => card.suit !== "H" ) ).toBe( true );
		expect( result.length ).toBe( 39 );
	} );
} );

describe( "getBestCardPlayed", () => {
	it( "returns undefined if no cards played", () => {
		expect( utils.getBestCardPlayed( [], "H", "H" ) ).toBeUndefined();
	} );

	it( "returns best trump card", () => {
		const cards = [ kingHearts, aceHearts ];
		expect( utils.getBestCardPlayed( cards, "H", "H" ) ).toEqual( aceHearts );
	} );

	it( "returns best round suit card if no trump present", () => {
		const cards = [ queenHearts, kingHearts ];
		expect( getBestCardPlayed( cards, "C", "H" ) ).toEqual( kingHearts );
	} );

	it( "returns best trump card if only trump present", () => {
		const cards = [ queenClubs, kingClubs ];
		expect( getBestCardPlayed( cards, "C", "H" ) ).toEqual( kingClubs );
	} );

	it( "returns best trump card if both trump and round suit present", () => {
		const cards = [ queenHearts, kingClubs, aceClubs ];
		expect( getBestCardPlayed( cards, "C", "H" ) ).toEqual( aceClubs );
	} );

	it( "returns best round suit card if no trump and round suit present", () => {
		const cards = [ queenHearts, kingHearts, aceHearts ];
		expect( getBestCardPlayed( cards, "C", "H" ) ).toEqual( aceHearts );
	} );

	it( "returns best card among others if no trump or round suit present", () => {
		const cards = [ queenSpades, kingSpades ];
		expect( getBestCardPlayed( cards, "C", "H" ) ).toEqual( kingSpades );
	} );

	it( "returns undefined if roundSuit is not provided", () => {
		const cards = [ queenHearts, kingHearts ];
		expect( getBestCardPlayed( cards, "C" ) ).toBeUndefined();
	} );
} );

describe( "getPlayableCards", () => {
	it( "returns all if no greatest or roundSuit", () => {
		expect( utils.getPlayableCards( hand, "H" ) ).toEqual( hand );
	} );

	it( "returns cards of round suit if available", () => {
		expect( utils.getPlayableCards( hand, "C", kingHearts, "H" ) ).toContainEqual( aceHearts );
	} );

	it( "returns hand if no cards of round suit or trump suit", () => {
		const hand = [ aceSpades, kingSpades ];
		expect( getPlayableCards( hand, CARD_SUITS.CLUBS, kingHearts, CARD_SUITS.HEARTS ) ).toEqual( hand );
	} );

	it( "returns only trump cards if no round suit cards and greatest is not trump", () => {
		const hand = [ aceClubs, kingClubs ];
		expect( getPlayableCards( hand, CARD_SUITS.CLUBS, kingHearts, CARD_SUITS.HEARTS ) ).toEqual( hand );
	} );

	it( "returns only round suit cards if no trump cards and greatest is not trump", () => {
		const hand = [ aceHearts, kingHearts ];
		expect( getPlayableCards( hand, CARD_SUITS.CLUBS, kingClubs, CARD_SUITS.HEARTS ) ).toEqual( hand );
	} );

	it( "returns greater trump cards if no round suit cards and greatest is trump", () => {
		const hand = [ aceClubs, kingClubs ];
		expect( getPlayableCards( hand, CARD_SUITS.CLUBS, kingClubs, CARD_SUITS.HEARTS ) ).toEqual( [ aceClubs ] );
	} );

	it( "returns greater round suit cards if greatest is not trump", () => {
		const hand = [ queenHearts, kingHearts, aceHearts ];
		expect( getPlayableCards( hand, CARD_SUITS.CLUBS, kingHearts, CARD_SUITS.HEARTS ) ).toEqual( [ aceHearts ] );
	} );

	it( "returns all round suit cards if none are greater than greatest", () => {
		const hand = [ queenHearts, kingHearts ];
		expect( getPlayableCards( hand, CARD_SUITS.CLUBS, aceHearts, CARD_SUITS.HEARTS ) ).toEqual( hand );
	} );

	it( "returns all hand if round suit equals trump and no cards of that suit", () => {
		const hand = [ aceSpades, kingSpades ];
		expect( getPlayableCards( hand, CARD_SUITS.HEARTS, kingHearts, CARD_SUITS.HEARTS ) ).toEqual( hand );
	} );

	it( "returns greater cards of round suit if round suit equals trump", () => {
		const hand = [ queenHearts, kingHearts, aceHearts ];
		expect( getPlayableCards( hand, CARD_SUITS.HEARTS, kingHearts, CARD_SUITS.HEARTS ) ).toEqual( [ aceHearts ] );
	} );

	it( "returns all round suit cards if none are greater and round suit equals trump", () => {
		const hand = [ queenHearts, kingHearts ];
		expect( getPlayableCards( hand, CARD_SUITS.HEARTS, aceHearts, CARD_SUITS.HEARTS ) ).toEqual( hand );
	} );

} );

describe( "canCardBePlayed", () => {
	it( "returns true if card is in hand and playable", () => {
		expect( utils.canCardBePlayed( aceHearts, hand, "H", [], "H" ) ).toBe( true );
	} );

	it( "returns false if card not in hand", () => {
		expect( utils.canCardBePlayed( "QS", hand, "H", [], "H" ) ).toBe( false );
	} );

	it( "returns false if card is in hand but not playable", () => {
		const hand = [ aceHearts, kingHearts, aceClubs ];
		// Only round suit cards allowed, but try to play a trump
		expect( canCardBePlayed( aceClubs, hand, CARD_SUITS.CLUBS, [ kingHearts ], CARD_SUITS.HEARTS ) ).toBe( false );
	} );

	it( "returns false if card is not in hand but would be playable if present", () => {
		const hand = [ aceHearts, kingHearts ];
		// Try to play a card not in hand
		expect( canCardBePlayed( aceClubs, hand, CARD_SUITS.CLUBS, [ kingHearts ], CARD_SUITS.HEARTS ) ).toBe( false );
	} );

	it( "returns true if card is in hand and no round suit or greatest", () => {
		const hand = [ aceHearts, kingHearts ];
		expect( canCardBePlayed( aceHearts, hand, CARD_SUITS.CLUBS, [], undefined ) ).toBe( true );
	} );

	it( "returns true if card is a trump and only trumps are left", () => {
		const hand = [ aceClubs, kingClubs ];
		expect( canCardBePlayed( aceClubs, hand, CARD_SUITS.CLUBS, [ kingClubs ], CARD_SUITS.HEARTS ) ).toBe( true );
	} );

	it( "returns false if card is not a round suit and round suit cards are available", () => {
		const hand = [ aceHearts, kingHearts, aceClubs ];
		expect( canCardBePlayed( aceClubs, hand, CARD_SUITS.CLUBS, [ kingHearts ], CARD_SUITS.HEARTS ) ).toBe( false );
	} );

	it( "returns true if card is the only playable card", () => {
		const hand = [ aceSpades ];
		expect( canCardBePlayed( aceSpades, hand, CARD_SUITS.CLUBS, [ kingHearts ], CARD_SUITS.HEARTS ) ).toBe( true );
	} );
} );