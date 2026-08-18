import { describe, expect, test } from "bun:test";

import { CALLBREAK_TRICKS_PER_DEAL } from "@/games/callbreak/shared/schema.ts";
import {
	calculateRoundScore,
	createNewDeal,
	decideWinner,
	determineTrickWinner,
	rankPlayers,
	standingsFor
} from "@/games/callbreak/server/utils.ts";
import {
	getCardValue,
	getHighestCardValue,
	getPlayableCards,
	RANK_ORDER
} from "@/games/callbreak/shared/utils.ts";
import { makeRng } from "@/shared/utils/rng.ts";
import { PlayerId } from "@/swish/shared/schema.ts";

import type { Trick } from "@/games/callbreak/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";
import type { PlayerId as Player } from "@/swish/shared/schema.ts";

const seat = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d ] = [ seat( "a" ), seat( "b" ), seat( "c" ), seat( "d" ) ];

const seats: ReadonlyArray<Player> = [ a, b, c, d ];

/** A trick built from `[ seat, card ]` pairs, led by the first of them. */
const trick = ( ...played: ReadonlyArray<readonly [ Player, CardId ]> ) => {
	const [ lead ] = played;

	return {
		leadPlayer: lead![ 0 ],
		suit: lead![ 1 ].slice( -1 ),
		cards: Object.fromEntries( played )
	} as Trick;
};


describe( "ranking cards", () => {
	test( "runs two low to ace high, unlike the deck's own order", () => {
		expect( RANK_ORDER[ 0 ] ).toBe( "2" );
		expect( RANK_ORDER[ RANK_ORDER.length - 1 ] ).toBe( "A" );
		expect( getCardValue( "AS" ) ).toBeGreaterThan( getCardValue( "KS" ) );
		expect( getCardValue( "10S" ) ).toBeGreaterThan( getCardValue( "9S" ) );
		expect( getCardValue( "2S" ) ).toBe( 0 );
	} );

	test( "ignores every suit but the one asked for", () => {
		const cards: ReadonlyArray<CardId> = [ "2S", "AH", "KS", "AD" ];

		expect( getHighestCardValue( cards, "S" ) ).toBe( getCardValue( "KS" ) );
		expect( getHighestCardValue( cards, "C" ) ).toBe( -1 );
	} );
} );


describe( "settling a trick", () => {
	test( "gives it to the highest card of the led suit", () => {
		const played = trick( [ a, "4H" ], [ b, "KH" ], [ c, "7H" ], [ d, "2H" ] );
		expect( determineTrickWinner( played, "S", seats ) ).toBe( b );
	} );

	test( "gives it to the leader when nobody beats them in suit", () => {
		const played = trick( [ a, "AH" ], [ b, "KH" ], [ c, "7H" ], [ d, "2H" ] );
		expect( determineTrickWinner( played, "S", seats ) ).toBe( a );
	} );

	test( "lets any trump beat the best card of the led suit", () => {
		const played = trick( [ a, "AH" ], [ b, "KH" ], [ c, "2S" ], [ d, "QH" ] );
		expect( determineTrickWinner( played, "S", seats ) ).toBe( c );
	} );

	test( "settles a trump war on the highest trump", () => {
		const played = trick( [ a, "AH" ], [ b, "2S" ], [ c, "JS" ], [ d, "9S" ] );
		expect( determineTrickWinner( played, "S", seats ) ).toBe( c );
	} );

	test( "reads off-suit discards as losers however high they are", () => {
		const played = trick( [ a, "3H" ], [ b, "AD" ], [ c, "AC" ], [ d, "2H" ] );
		expect( determineTrickWinner( played, "S", seats ) ).toBe( a );
	} );

	test( "walks the seating order, not the key order of the cards", () => {
		// Numeric-looking ids are exactly the case a `for … in` over the cards
		// would reorder, and the two highest hearts are seated either side of it.
		const [ one, two, three ] = [ seat( "2" ), seat( "10" ), seat( "1" ) ];
		const played = trick( [ one, "3H" ], [ two, "KH" ], [ three, "AH" ] );

		expect( determineTrickWinner( played, "S", [ one, two, three ] ) ).toBe( three );
	} );
} );


describe( "what a seat may play", () => {
	const hand: ReadonlyArray<CardId> = [ "2H", "QH", "AH", "3S", "KS", "4D" ];

	test( "leaves the leader every card in hand", () => {
		const empty = { leadPlayer: a, cards: {} } as Trick;
		expect( getPlayableCards( hand, "S", empty ) ).toEqual( [ ...hand ] );
	} );

	test( "makes a seat holding the led suit head the trick when it can", () => {
		const played = trick( [ b, "JH" ] );
		expect( getPlayableCards( hand, "S", played ) ).toEqual( [ "QH", "AH" ] );
	} );

	test( "falls back to any card of the led suit when none of them wins", () => {
		const played = trick( [ b, "AH" ] );
		expect( getPlayableCards( hand, "S", played ) ).toEqual( [ "2H", "QH", "AH" ] );
	} );

	test( "drops the heading rule once a trump has taken the trick", () => {
		const played = trick( [ b, "3H" ], [ c, "2S" ] );
		expect( getPlayableCards( hand, "S", played ) ).toEqual( [ "2H", "QH", "AH" ] );
	} );

	test( "keeps the heading rule when the led suit is trump", () => {
		const played = trick( [ b, "JS" ] );
		expect( getPlayableCards( hand, "S", played ) ).toEqual( [ "KS" ] );
	} );

	test( "forces a trump out of a seat void in the led suit", () => {
		const played = trick( [ b, "5C" ] );
		expect( getPlayableCards( hand, "S", played ) ).toEqual( [ "3S", "KS" ] );
	} );

	test( "forces an overtrump when one is held", () => {
		const played = trick( [ b, "5C" ], [ c, "JS" ] );
		expect( getPlayableCards( hand, "S", played ) ).toEqual( [ "KS" ] );
	} );

	test( "frees the whole hand when the trumps held cannot overtrump", () => {
		const played = trick( [ b, "5C" ], [ c, "AS" ] );
		expect( getPlayableCards( hand, "S", played ) ).toEqual( [ ...hand ] );
	} );

	test( "frees the whole hand when the seat holds neither the led suit nor trump", () => {
		const short: ReadonlyArray<CardId> = [ "2H", "AH", "4D" ];
		const played = trick( [ b, "5C" ] );
		expect( getPlayableCards( short, "S", played ) ).toEqual( [ ...short ] );
	} );
} );


describe( "scoring a deal", () => {
	test( "pays the call plus two tenths for every overtrick", () => {
		expect( calculateRoundScore( 3, 3 ) ).toBe( 30 );
		expect( calculateRoundScore( 3, 5 ) ).toBe( 34 );
		expect( calculateRoundScore( 1, 13 ) ).toBe( 34 );
	} );

	test( "costs the whole call when the seat falls short", () => {
		expect( calculateRoundScore( 3, 2 ) ).toBe( -30 );
		expect( calculateRoundScore( 3, 0 ) ).toBe( -30 );
	} );
} );


describe( "dealing", () => {
	test( "cuts the whole deck into four disjoint thirteens", () => {
		const deal = createNewDeal( seats, b, makeRng( 7 ).next );
		const dealt = seats.flatMap( id => [ ...deal.hands[ id ]! ] );

		for ( const id of seats ) {
			expect( deal.hands[ id ] ).toHaveLength( CALLBREAK_TRICKS_PER_DEAL );
			expect( deal.declarations[ id ] ).toBe( 0 );
			expect( deal.wins[ id ] ).toBe( 0 );
			expect( deal.scores[ id ] ).toBe( 0 );
		}

		expect( new Set( dealt ).size ).toBe( 52 );
		expect( deal.startingPlayer ).toBe( b );
		expect( deal.tricks ).toEqual( [] );
	} );

	test( "deals the same hands twice from the same seeded stream", () => {
		const first = createNewDeal( seats, a, makeRng( 42 ).next );
		const second = createNewDeal( seats, a, makeRng( 42 ).next );

		expect( second.hands ).toEqual( first.hands );
	} );

	test( "deals different hands from a different stream", () => {
		const first = createNewDeal( seats, a, makeRng( 1 ).next );
		const second = createNewDeal( seats, a, makeRng( 2 ).next );

		expect( second.hands ).not.toEqual( first.hands );
	} );
} );


describe( "standings", () => {
	test( "ranks the table best-first and names the top seat", () => {
		const scores = { [ a ]: 30, [ b ]: 52, [ c ]: -10, [ d ]: 51 };

		expect( rankPlayers( seats, scores ) ).toEqual( [ b, d, a, c ] );
		expect( standingsFor( seats, scores ) ).toEqual( {
			ranking: [
				{ playerId: b, rank: 1, score: 52 },
				{ playerId: d, rank: 2, score: 51 },
				{ playerId: a, rank: 3, score: 30 },
				{ playerId: c, rank: 4, score: -10 }
			],
			winner: b
		} );
	} );

	test( "shares a rank on a tie and skips the place it consumed", () => {
		const scores = { [ a ]: 40, [ b ]: 40, [ c ]: 20, [ d ]: 10 };
		const { ranking } = standingsFor( seats, scores );

		expect( ranking.map( entry => entry.rank ) ).toEqual( [ 1, 1, 3, 4 ] );
	} );

	test( "names nobody when the top is shared", () => {
		const scores = { [ a ]: 40, [ b ]: 40, [ c ]: 20, [ d ]: 10 };

		expect( decideWinner( seats, scores ) ).toBeUndefined();
		expect( standingsFor( seats, scores ).winner ).toBeUndefined();
	} );

	test( "treats a seat with no recorded score as zero", () => {
		expect( decideWinner( seats, { [ a ]: -5 } ) ).toBeUndefined();
		expect( decideWinner( seats, { [ a ]: 5 } ) ).toBe( a );
	} );
} );
