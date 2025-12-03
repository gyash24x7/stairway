import type { PlayingCard } from "@s2h/cards/types";
import { getCardId } from "@s2h/cards/utils";
import { describe, expect, it } from "vitest";
import {
	CANADIAN_BOOKS,
	getBookForCard,
	getBooksInHand,
	getCardsOfBook,
	getMissingCards,
	isBookInHand,
	NORMAL_BOOKS
} from "../src/utils.ts";

describe( "Fish utils", () => {
	it( "getBookForCard - NORMAL with CardId", () => {
		expect( getBookForCard( "AC", "NORMAL" ) ).toBe( "ACES" );
	} );

	it( "getBookForCard - NORMAL with PlayingCard", () => {
		expect( getBookForCard( { rank: "A", suit: "C" }, "NORMAL" ) ).toBe( "ACES" );
	} );

	it( "getBookForCard - CANADIAN with CardId", () => {
		expect( getBookForCard( "AC", "CANADIAN" ) ).toBe( "LC" );
	} );

	it( "getBooksInHand returns unique books (NORMAL)", () => {
		const hand: PlayingCard[] = [
			{ rank: "A", suit: "C" },
			{ rank: "2", suit: "H" },
			{ rank: "K", suit: "S" },
			{ rank: "8", suit: "C" }
		];
		const books = new Set( getBooksInHand( hand, "NORMAL" ) );
		expect( books ).toEqual( new Set( [ "ACES", "TWOS", "KINGS", "EIGHTS" ] ) );
	} );

	it( "isBookInHand true/false (NORMAL)", () => {
		const hand: PlayingCard[] = [
			{ rank: "A", suit: "C" },
			{ rank: "A", suit: "H" },
			{ rank: "3", suit: "D" }
		];
		expect( isBookInHand( hand, "ACES", "NORMAL" ) ).toBeTruthy();
		expect( isBookInHand( hand, "TWOS", "NORMAL" ) ).toBe( false );
	} );

	it( "getMissingCards returns correct missing ids (NORMAL)", () => {
		// For ACES: ["AC","AD","AH","AS"]
		const hand: PlayingCard[] = [
			{ rank: "A", suit: "C" }, // AC present
			{ rank: "A", suit: "S" }  // AS present
		];
		const missing = getMissingCards( hand, "ACES", "NORMAL" );
		// Expect the remaining in order from NORMAL_BOOKS
		expect( missing ).toEqual( [ "AD", "AH" ] );
	} );

	it( "getMissingCards returns full book when hand empty (CANADIAN)", () => {
		const missing = getMissingCards( [], "LC", "CANADIAN" );
		expect( missing ).toEqual( CANADIAN_BOOKS[ "LC" ] );
	} );

	it( "getCardsOfBook returns PlayingCard array (NORMAL)", () => {
		const cards = getCardsOfBook( "ACES", "NORMAL" );
		// convert back to ids for easy comparison
		const ids = cards.map( getCardId );
		expect( ids ).toEqual( NORMAL_BOOKS[ "ACES" ] );
	} );

	it( "getCardsOfBook filters by hand when provided (NORMAL)", () => {
		const hand: PlayingCard[] = [
			{ rank: "A", suit: "C" }, // AC
			{ rank: "A", suit: "H" }  // AH
		];
		const cards = getCardsOfBook( "ACES", "NORMAL", hand );
		const ids = cards.map( getCardId );
		expect( ids ).toEqual( [ "AC", "AH" ] );
	} );

	it( "getCardsOfBook returns CANADIAN book correctly", () => {
		const ids = getCardsOfBook( "LC", "CANADIAN" ).map( getCardId );
		expect( ids ).toEqual( CANADIAN_BOOKS[ "LC" ] );
	} );
} );
