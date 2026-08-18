import { describe, expect, test } from "bun:test";

import { isBookInHand } from "@/games/fish/server/utils.ts";
import {
	CANADIAN_BOOKS,
	getAskDescription,
	getBookDisplayString,
	getBookForCard,
	getBooksInHand,
	getBookSuit,
	getCardsOfBook,
	getClaimDescription,
	getMissingCards,
	getTransferDescription,
	NORMAL_BOOKS
} from "@/games/fish/shared/utils.ts";
import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";

import type { Ask, Book, Claim, Transfer } from "@/games/fish/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ alice, bob ] = [ player( "alice" ), player( "bob" ) ];

const roster: Record<Player, PlayerInfo> = {
	[ alice ]: PlayerInfo.make( { id: alice, name: "Alice", avatar: "avatar" } ),
	[ bob ]: PlayerInfo.make( { id: bob, name: "Bob", avatar: "avatar" } )
};


describe( "the two variants' books", () => {
	test( "a normal book is a rank, four cards wide", () => {
		expect( Object.keys( NORMAL_BOOKS ) ).toHaveLength( 13 );
		expect( Object.values( NORMAL_BOOKS ).every( cards => cards.length === 4 ) ).toBe( true );
	} );

	test( "a canadian book is half a suit, six cards wide", () => {
		expect( Object.keys( CANADIAN_BOOKS ) ).toHaveLength( 8 );
		expect( Object.values( CANADIAN_BOOKS ).every( cards => cards.length === 6 ) ).toBe( true );
	} );

	test( "their names are disjoint, which is what lets a book identify its variant", () => {
		const normal = new Set( Object.keys( NORMAL_BOOKS ) );
		const canadian = Object.keys( CANADIAN_BOOKS );

		expect( canadian.some( book => normal.has( book ) ) ).toBe( false );
	} );

	test( "the canadian deck leaves the sevens out altogether", () => {
		const dealt = Object.values( CANADIAN_BOOKS ).flat();

		expect( dealt.filter( card => card.startsWith( "7" ) ) ).toEqual( [] );
		expect( dealt ).toHaveLength( 48 );
	} );
} );


describe( "getBookForCard", () => {
	test( "finds a card's rank book in a normal game", () => {
		expect( getBookForCard( "AH", "NORMAL" ) ).toBe( "ACES" );
		expect( getBookForCard( "10S", "NORMAL" ) ).toBe( "TENS" );
	} );

	test( "finds a card's half-suit book in a canadian game", () => {
		expect( getBookForCard( "AH", "CANADIAN" ) ).toBe( "LH" );
		expect( getBookForCard( "KS", "CANADIAN" ) ).toBe( "US" );
	} );

	test( "answers with nothing for a card the variant's deck has no book for", () => {
		// A seven in a canadian game — and a caller taking a card from client input
		// must handle it, which is what stops a hostile claim becoming a throw.
		expect( getBookForCard( "7C", "CANADIAN" ) ).toBeUndefined();
		expect( getBookForCard( "7C", "NORMAL" ) ).toBe( "SEVENS" );
	} );
} );


describe( "getBooksInHand", () => {
	test( "lists each book a hand touches, once", () => {
		const hand: CardId[] = [ "AH", "AC", "2S", "KD" ];

		expect( getBooksInHand( hand, "NORMAL" ).sort() ).toEqual( [ "ACES", "KINGS", "TWOS" ] );
	} );

	test( "an empty hand touches none", () => {
		expect( getBooksInHand( [], "NORMAL" ) ).toEqual( [] );
	} );

	test( "drops a card the variant has no book for", () => {
		expect( getBooksInHand( [ "7C", "AH" ], "CANADIAN" ) ).toEqual( [ "LH" ] );
	} );
} );


describe( "isBookInHand", () => {
	test( "is true when the hand holds any card of the book", () => {
		expect( isBookInHand( [ "AH", "2S" ], "ACES", "NORMAL" ) ).toBe( true );
	} );

	test( "is false when it holds none", () => {
		expect( isBookInHand( [ "2S" ], "ACES", "NORMAL" ) ).toBe( false );
	} );
} );


describe( "getMissingCards", () => {
	test( "names the cards of a book the hand does not hold", () => {
		expect( getMissingCards( [ "AC", "AD" ], "ACES", "NORMAL" ).sort() )
			.toEqual( [ "AH", "AS" ] );
	} );

	test( "a complete book is missing nothing", () => {
		expect( getMissingCards( [ ...NORMAL_BOOKS.ACES ], "ACES", "NORMAL" ) ).toEqual( [] );
	} );

	test( "reads the canadian layout when that is the variant", () => {
		expect( getMissingCards( [ "AH", "2H", "3H" ], "LH", "CANADIAN" ) )
			.toEqual( [ "4H", "5H", "6H" ] );
	} );
} );


describe( "getCardsOfBook", () => {
	test( "gives every card of the book, without being told the variant", () => {
		expect( getCardsOfBook( "ACES" ) ).toEqual( [ ...NORMAL_BOOKS.ACES ] );
		expect( getCardsOfBook( "UD" ) ).toEqual( [ ...CANADIAN_BOOKS.UD ] );
	} );

	test( "filters to the hand when one is given", () => {
		expect( getCardsOfBook( "ACES", [ "AH", "2S", "AD" ] ).sort() ).toEqual( [ "AD", "AH" ] );
	} );

	test( "an unknown book has no cards rather than throwing", () => {
		expect( getCardsOfBook( "NOPE" as Book ) ).toEqual( [] );
	} );
} );


describe( "how a book reads", () => {
	test( "a normal book reads as its own name", () => {
		expect( getBookDisplayString( "ACES", "NORMAL" ) ).toBe( "ACES" );
	} );

	test( "a canadian book reads as its half and its suit", () => {
		expect( getBookDisplayString( "LC", "CANADIAN" ) ).toBe( "LOW ♣" );
		expect( getBookDisplayString( "UH", "CANADIAN" ) ).toBe( "HIGH ♥" );
	} );

	test( "every canadian book has a display of its own", () => {
		const displays = Object.keys( CANADIAN_BOOKS )
			.map( book => getBookDisplayString( book as Book, "CANADIAN" ) );

		expect( new Set( displays ).size ).toBe( 8 );
	} );
} );


describe( "getBookSuit", () => {
	test( "names the suit of a canadian book", () => {
		expect( getBookSuit( "LC", "CANADIAN" ) ).toBe( "C" );
		expect( getBookSuit( "US", "CANADIAN" ) ).toBe( "S" );
	} );

	test( "a normal book has no suit — it is a rank across all of them", () => {
		expect( getBookSuit( "ACES", "NORMAL" ) ).toBeUndefined();
	} );
} );


describe( "describing what happened", () => {
	const ask = ( success: boolean ): Ask =>
		( { _tag: "fish/Ask", success, playerId: alice, from: bob, cardId: "AH" } );

	test( "an ask that landed", () => {
		expect( getAskDescription( ask( true ), roster ) )
			.toBe( "Alice asked Bob for ACE OF HEARTS and got the card!" );
	} );

	test( "an ask that was refused", () => {
		expect( getAskDescription( ask( false ), roster ) )
			.toContain( "was declined!" );
	} );

	test( "a declaration that came out right", () => {
		const claim: Claim = {
			_tag: "fish/Claim",
			success: true,
			playerId: alice,
			book: "ACES",
			correctClaim: {},
			actualClaim: {}
		};

		expect( getClaimDescription( claim, roster, "NORMAL" ) )
			.toBe( "Alice declared ACES correctly!" );
	} );

	test( "a declaration that did not, in the variant's own words", () => {
		const claim: Claim = {
			_tag: "fish/Claim",
			success: false,
			playerId: bob,
			book: "UH",
			correctClaim: {},
			actualClaim: {}
		};

		expect( getClaimDescription( claim, roster, "CANADIAN" ) )
			.toBe( "Bob declared HIGH ♥ incorrectly!" );
	} );

	test( "a turn handed to a teammate", () => {
		const transfer: Transfer = { _tag: "fish/Transfer", playerId: alice, transferTo: bob };

		expect( getTransferDescription( transfer, roster ) )
			.toBe( "Alice transferred the turn to Bob" );
	} );
} );
