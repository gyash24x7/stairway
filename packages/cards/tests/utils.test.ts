import { describe, expect, it } from "vitest";
import { SORTED_DECK } from "../src/constants.ts";
import type { PlayingCard } from "../src/types.ts";
import {
	compareCards,
	generateDeck,
	generateHands,
	getCardDisplayString,
	getCardFromId,
	getCardId,
	getCardImage,
	getCardsOfSuit,
	getCardSuit,
	getSortedHand,
	getSuitsInHand,
	isCardInHand,
	isCardSuitInHand
} from "../src/utils.ts";

describe( "Card Utils", () => {
	const card = { rank: "A" as const, suit: "H" as const };

	it( "getCardId", () => {
		expect( getCardId( card ) ).toBe( "AH" );
	} );

	it( "getCardDisplayString with PlayingCard", () => {
		expect( getCardDisplayString( card ) ).toBe( "ACE OF HEARTS" );
	} );

	it( "getCardDisplayString with CardId", () => {
		expect( getCardDisplayString( "AH" ) ).toBe( "ACE OF HEARTS" );
	} );

	it( "getCardImage with PlayingCard", () => {
		expect( getCardImage( card ) ).toBe( "/cards/AH.svg" );
	} );

	it( "getCardImage with CardId", () => {
		expect( getCardImage( "AH" ) ).toBe( "/cards/AH.svg" );
	} );

	it( "getCardSuit with PlayingCard", () => {
		expect( getCardSuit( card ) ).toBe( "H" );
	} );

	it( "getCardSuit with CardId", () => {
		expect( getCardSuit( "AH" ) ).toBe( "H" );
	} );

	it( "compareCards: same suit, ace wins", () => {
		expect( compareCards( { rank: "A", suit: "H" }, { rank: "K", suit: "H" } ) ).toBeTruthy();
		expect( compareCards( { rank: "K", suit: "H" }, { rank: "A", suit: "H" } ) ).toBe( false );
		expect( compareCards( { rank: "K", suit: "H" }, { rank: "J", suit: "H" } ) ).toBeTruthy();
	} );

	it( "compareCards: different suits", () => {
		expect( compareCards( { rank: "A", suit: "H" }, { rank: "A", suit: "S" } ) ).toBe( false );
	} );

	it( "getCardFromId", () => {
		expect( getCardFromId( "AH" ) ).toEqual( { rank: "A", suit: "H" } );
	} );

	it( "getCardsOfSuit", () => {
		const hand: PlayingCard[] = [ { rank: "K", suit: "H" }, { rank: "A", suit: "S" }, { rank: "2", suit: "H" } ];
		expect( getCardsOfSuit( "H", hand ) ).toEqual( [
			{ rank: "K", suit: "H" },
			{ rank: "2", suit: "H" }
		] );
	} );

	it( "getSuitsInHand", () => {
		expect( getSuitsInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		] ) ).toEqual( new Set( [ "H", "S" ] ) );
	} );

	it( "isCardSuitInHand", () => {
		expect( isCardSuitInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		], "H" ) ).toBeTruthy();
		expect( isCardSuitInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		], "C" ) ).toBe( false );
	} );

	it( "isCardInHand", () => {
		expect( isCardInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		], "AH" ) ).toBeTruthy();
		expect( isCardInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		], "10C" ) ).toBe( false );
	} );

	it( "getSortedHand", () => {
		const hand: PlayingCard[] = [ { rank: "K", suit: "H" }, { rank: "A", suit: "S" } ];
		expect( getSortedHand( hand ) ).toEqual( [
			{ rank: "A", suit: "S" },
			{ rank: "K", suit: "H" }
		] );
	} );

	it( "generateDeck", () => {
		const deck = generateDeck();
		expect( deck.length ).toBe( 52 );
		expect( getSortedHand( deck ) ).toEqual( SORTED_DECK );
	} );

	it( "generateHands: even split", () => {
		const hands = generateHands( SORTED_DECK, 2 );
		expect( hands.length ).toBe( 2 );
		expect( hands[ 0 ].length ).toBe( 26 );
		expect( hands[ 1 ].length ).toBe( 26 );
		expect( hands[ 0 ] ).toEqual( SORTED_DECK.slice( 0, 26 ) );
		expect( hands[ 1 ] ).toEqual( SORTED_DECK.slice( 26 ) );
	} );

	it( "generateHands: uneven split", () => {
		expect( generateHands( SORTED_DECK, 3 ) ).toEqual( [] );
	} );
} );
