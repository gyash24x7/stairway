import { describe, expect, it } from "bun:test";

import type { CardId } from "@/shared/cards/schema.ts";
import {
	CARD_IDS,
	CARD_RANKS,
	CARD_SUITS,
	generateDeck,
	generateHands,
	getCardDisplayString,
	getCardRank,
	getCardSuit,
	getSortedHand,
	SORTED_DECK
} from "@/shared/cards/utils.ts";
import { mulberry32 } from "@/shared/utils/rng.ts";

describe( "SORTED_DECK", () => {
	it( "contains 52 unique cards", () => {
		expect( SORTED_DECK ).toHaveLength( 52 );
		expect( new Set( SORTED_DECK ).size ).toBe( 52 );
	} );

	it( "is grouped by suit, with ranks in order within each suit", () => {
		expect( SORTED_DECK.slice( 0, 13 ) ).toEqual(
			[ "AC", "2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "10C", "JC", "QC", "KC" ]
		);
		expect( SORTED_DECK.at( -1 ) ).toBe( "KD" );
		expect( SORTED_DECK.map( getCardSuit ).join( "" ) ).toBe(
			"C".repeat( 13 ) + "S".repeat( 13 ) + "H".repeat( 13 ) + "D".repeat( 13 )
		);
	} );

	it( "holds every rank/suit combination exactly once", () => {
		for ( const rank of Object.values( CARD_RANKS ) ) {
			for ( const suit of Object.values( CARD_SUITS ) ) {
				expect( SORTED_DECK.filter( c => c === `${ rank }${ suit }` ) ).toHaveLength( 1 );
			}
		}
	} );
} );

describe( "CARD_IDS", () => {
	it( "is the same 52 cards as SORTED_DECK, grouped by rank instead of suit", () => {
		expect( CARD_IDS ).toHaveLength( 52 );
		expect( new Set( CARD_IDS ) ).toEqual( new Set( SORTED_DECK ) );
		expect( CARD_IDS.slice( 0, 4 ) ).toEqual( [ "AC", "AS", "AH", "AD" ] );
	} );
} );

describe( "getCardRank", () => {
	it( "reads the rank off a single-character rank", () => {
		expect( getCardRank( "AH" ) ).toBe( "A" );
		expect( getCardRank( "7S" ) ).toBe( "7" );
		expect( getCardRank( "KD" ) ).toBe( "K" );
	} );

	it( "reads the two-character rank of a ten", () => {
		expect( getCardRank( "10C" ) ).toBe( "10" );
	} );

	it( "agrees with the deck for every card", () => {
		for ( const card of SORTED_DECK ) {
			expect( Object.values( CARD_RANKS ) ).toContain( getCardRank( card ) );
		}
	} );
} );

describe( "getCardSuit", () => {
	it( "reads the trailing suit character", () => {
		expect( getCardSuit( "AH" ) ).toBe( "H" );
		expect( getCardSuit( "10C" ) ).toBe( "C" );
		expect( getCardSuit( "QS" ) ).toBe( "S" );
		expect( getCardSuit( "2D" ) ).toBe( "D" );
	} );

	it( "agrees with the deck for every card", () => {
		for ( const card of SORTED_DECK ) {
			expect( Object.values( CARD_SUITS ) ).toContain( getCardSuit( card ) );
		}
	} );
} );

describe( "getCardRank + getCardSuit", () => {
	it( "round-trips back to the card id for every card in the deck", () => {
		for ( const card of SORTED_DECK ) {
			expect( `${ getCardRank( card ) }${ getCardSuit( card ) }` ).toBe( card );
		}
	} );
} );

describe( "getCardDisplayString", () => {
	it( "formats a card as RANK OF SUIT", () => {
		expect( getCardDisplayString( "AH" ) ).toBe( "ACE OF HEARTS" );
		expect( getCardDisplayString( "KD" ) ).toBe( "KING OF DIAMONDS" );
		expect( getCardDisplayString( "2C" ) ).toBe( "TWO OF CLUBS" );
	} );

	it( "formats the ten correctly despite its two-character rank", () => {
		expect( getCardDisplayString( "10S" ) ).toBe( "TEN OF SPADES" );
	} );

	it( "produces 52 distinct display strings", () => {
		expect( new Set( SORTED_DECK.map( getCardDisplayString ) ).size ).toBe( 52 );
	} );
} );

describe( "getSortedHand", () => {
	it( "returns the hand in sorted-deck order", () => {
		expect( getSortedHand( [ "KD", "AC", "10H", "2S" ] ) ).toEqual( [ "AC", "2S", "10H", "KD" ] );
	} );

	it( "returns a new array, leaving the input untouched", () => {
		const hand: CardId[] = [ "KD", "AC" ];
		const out = getSortedHand( hand );
		expect( out ).not.toBe( hand );
		expect( hand ).toEqual( [ "KD", "AC" ] );
	} );

	it( "returns an empty array for an empty hand", () => {
		expect( getSortedHand( [] ) ).toEqual( [] );
	} );

	it( "returns the whole deck when given the whole deck in any order", () => {
		expect( getSortedHand( [ ...SORTED_DECK ].reverse() ) ).toEqual( SORTED_DECK );
	} );

	it( "collapses duplicates, since it filters the deck rather than the hand", () => {
		expect( getSortedHand( [ "AC", "AC", "2C" ] ) ).toEqual( [ "AC", "2C" ] );
	} );
} );

describe( "generateDeck", () => {
	it( "returns a permutation of the sorted deck", () => {
		const deck = generateDeck();
		expect( deck ).toHaveLength( 52 );
		expect( getSortedHand( deck ) ).toEqual( SORTED_DECK );
	} );

	it( "does not mutate SORTED_DECK", () => {
		const before = [ ...SORTED_DECK ];
		generateDeck();
		generateDeck( mulberry32( 7 ) );
		expect( SORTED_DECK ).toEqual( before );
	} );

	it( "is reproducible from a seeded rng", () => {
		expect( generateDeck( mulberry32( 42 ) ) ).toEqual( generateDeck( mulberry32( 42 ) ) );
	} );

	it( "produces different orderings for different seeds", () => {
		expect( generateDeck( mulberry32( 1 ) ) ).not.toEqual( generateDeck( mulberry32( 2 ) ) );
	} );

	it( "actually shuffles (is not the sorted deck) under a seeded rng", () => {
		expect( generateDeck( mulberry32( 42 ) ) ).not.toEqual( SORTED_DECK );
	} );
} );

describe( "generateHands", () => {
	it( "splits a full deck into equal hands", () => {
		const hands = generateHands( SORTED_DECK, 4 );
		expect( hands ).toHaveLength( 4 );
		for ( const hand of hands ) {
			expect( hand ).toHaveLength( 13 );
		}
	} );

	it( "deals every card exactly once, in deck order", () => {
		const deck = generateDeck( mulberry32( 99 ) );
		const hands = generateHands( deck, 2 );
		expect( hands.flat() ).toEqual( deck );
		expect( new Set( hands.flat() ).size ).toBe( 52 );
	} );

	it( "deals contiguous slices of the deck", () => {
		expect( generateHands( [ "AC", "2C", "3C", "4C" ], 2 ) ).toEqual( [ [ "AC", "2C" ], [ "3C", "4C" ] ] );
	} );

	it( "returns a single hand holding the whole deck for a hand count of 1", () => {
		expect( generateHands( SORTED_DECK, 1 ) ).toEqual( [ SORTED_DECK ] );
	} );

	it( "returns an empty array when the deck does not divide evenly", () => {
		expect( generateHands( SORTED_DECK, 5 ) ).toEqual( [] );
		expect( generateHands( [ "AC", "2C", "3C" ], 2 ) ).toEqual( [] );
	} );

	it( "returns an empty array for a hand count of 0", () => {
		expect( generateHands( SORTED_DECK, 0 ) ).toEqual( [] );
	} );

	it( "handles an empty deck", () => {
		expect( generateHands( [], 4 ) ).toEqual( [] );
	} );
} );
