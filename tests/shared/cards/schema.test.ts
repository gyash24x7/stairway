import { describe, expect, it } from "bun:test";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { CardId, CardRank, CardSuit } from "@/shared/cards/schema.ts";
import { CARD_RANKS, CARD_SUITS, SORTED_DECK } from "@/shared/cards/utils.ts";

const decodeRank = Schema.decodeUnknownOption( CardRank );
const decodeSuit = Schema.decodeUnknownOption( CardSuit );
const decodeCard = Schema.decodeUnknownOption( CardId );

describe( "CardRank", () => {
	it( "accepts every rank the deck is built from", () => {
		for ( const rank of Object.values( CARD_RANKS ) ) {
			expect( decodeRank( rank ) ).toEqual( Option.some( rank ) );
		}
	} );

	it( "rejects ranks outside the literal set", () => {
		for ( const bad of [ "1", "11", "T", "a", "", 10 ] ) {
			expect( Option.isNone( decodeRank( bad ) ) ).toBe( true );
		}
	} );
} );

describe( "CardSuit", () => {
	it( "accepts every suit the deck is built from", () => {
		for ( const suit of Object.values( CARD_SUITS ) ) {
			expect( decodeSuit( suit ) ).toEqual( Option.some( suit ) );
		}
	} );

	it( "rejects suits outside the literal set", () => {
		for ( const bad of [ "X", "h", "hearts", "", null ] ) {
			expect( Option.isNone( decodeSuit( bad ) ) ).toBe( true );
		}
	} );
} );

describe( "CardId", () => {
	it( "accepts every card in the sorted deck", () => {
		for ( const card of SORTED_DECK ) {
			expect( decodeCard( card ) ).toEqual( Option.some( card ) );
		}
	} );

	it( "accepts the two-character ten ranks", () => {
		expect( decodeCard( "10H" ) ).toEqual( Option.some( "10H" ) );
	} );

	it( "rejects malformed card ids", () => {
		const cardIds = [ "H", "A", "AX", "1H", "TH", "AHH", "ah", "", "10", 42, null, undefined ];
		for ( const bad of cardIds ) {
			expect( Option.isNone( decodeCard( bad ) ) ).toBe( true );
		}
	} );
} );
