import { describe, expect, test } from "bun:test";
import { SORTED_DECK } from "../src/constants";
import type { PlayingCard } from "../src/types";
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
} from "../src/utils";

describe( "Card Utils", () => {
	const card = { rank: "A" as const, suit: "H" as const };

	test( "getCardId", () => {
		expect( getCardId( card ) ).toBe( "AH" );
	} );

	test( "getCardDisplayString with PlayingCard", () => {
		expect( getCardDisplayString( card ) ).toBe( "ACE OF HEARTS" );
	} );

	test( "getCardDisplayString with CardId", () => {
		expect( getCardDisplayString( "AH" ) ).toBe( "ACE OF HEARTS" );
	} );

	test( "getCardImage with PlayingCard", () => {
		expect( getCardImage( card ) ).toBe( "/cards/AH.svg" );
	} );

	test( "getCardImage with CardId", () => {
		expect( getCardImage( "AH" ) ).toBe( "/cards/AH.svg" );
	} );

	test( "getCardSuit with PlayingCard", () => {
		expect( getCardSuit( card ) ).toBe( "H" );
	} );

	test( "getCardSuit with CardId", () => {
		expect( getCardSuit( "AH" ) ).toBe( "H" );
	} );

	test( "compareCards: same suit, ace wins", () => {
		expect( compareCards( { rank: "A", suit: "H" }, { rank: "K", suit: "H" } ) ).toBe( true );
		expect( compareCards( { rank: "K", suit: "H" }, { rank: "A", suit: "H" } ) ).toBe( false );
		expect( compareCards( { rank: "K", suit: "H" }, { rank: "J", suit: "H" } ) ).toBe( true );
	} );

	test( "compareCards: different suits", () => {
		expect( compareCards( { rank: "A", suit: "H" }, { rank: "A", suit: "S" } ) ).toBe( false );
	} );

	test( "getCardFromId", () => {
		expect( getCardFromId( "AH" ) ).toEqual( { rank: "A", suit: "H" } );
	} );

	test( "getCardsOfSuit", () => {
		const hand: PlayingCard[] = [ { rank: "K", suit: "H" }, { rank: "A", suit: "S" }, { rank: "2", suit: "H" } ];
		expect( getCardsOfSuit( "H", hand ) ).toEqual( [
			{ rank: "K", suit: "H" },
			{ rank: "2", suit: "H" }
		] );
	} );

	test( "getSuitsInHand", () => {
		expect( getSuitsInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		] ) ).toEqual( new Set( [ "H", "S" ] ) );
	} );

	test( "isCardSuitInHand", () => {
		expect( isCardSuitInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		], "H" ) ).toBe( true );
		expect( isCardSuitInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		], "C" ) ).toBe( false );
	} );

	test( "isCardInHand", () => {
		expect( isCardInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		], "AH" ) ).toBe( true );
		expect( isCardInHand( [
			{ rank: "A", suit: "H" },
			{ rank: "K", suit: "H" },
			{ rank: "Q", suit: "H" },
			{ rank: "A", suit: "S" }
		], "10C" ) ).toBe( false );
	} );

	test( "getSortedHand", () => {
		const hand: PlayingCard[] = [ { rank: "K", suit: "H" }, { rank: "A", suit: "S" } ];
		expect( getSortedHand( hand ) ).toEqual( [
			{ rank: "A", suit: "S" },
			{ rank: "K", suit: "H" }
		] );
	} );

	test( "generateDeck", () => {
		const deck = generateDeck();
		expect( deck.length ).toBe( 52 );
		expect( getSortedHand( deck ) ).toEqual( SORTED_DECK );
	} );

	test( "generateHands: even split", () => {
		const hands = generateHands( SORTED_DECK, 2 );
		expect( hands.length ).toBe( 2 );
		expect( hands[ 0 ].length ).toBe( 26 );
		expect( hands[ 1 ].length ).toBe( 26 );
		expect( hands[ 0 ] ).toEqual( SORTED_DECK.slice( 0, 26 ) );
		expect( hands[ 1 ] ).toEqual( SORTED_DECK.slice( 26 ) );
	} );

	test( "generateHands: uneven split", () => {
		expect( generateHands( SORTED_DECK, 3 ) ).toEqual( [] );
	} );
} );
