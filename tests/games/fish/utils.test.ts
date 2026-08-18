import { describe, expect, test } from "bun:test";

import {
	buildBeliefs,
	holdsBookProbability,
	probability
} from "@/games/fish/server/bot/beliefs.ts";
import {
	buildConfig,
	FISH_TEAMS,
	getLiveBooks,
	getMetrics,
	isGameComplete,
	possibleHolders
} from "@/games/fish/server/utils.ts";
import type { PublicKnowledge } from "@/games/fish/shared/utils.ts";
import { getBookWinner, getTeamScores, teamCountsFor } from "@/games/fish/shared/utils.ts";
import type { GameContext, PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, TeamId } from "@/swish/shared/schema.ts";

import type { Ask, Claim, NormalBook } from "@/games/fish/shared/schema.ts";
import type { CardId } from "@/shared/cards/schema.ts";

const [ a, b, c, d ] = [ "a", "b", "c", "d" ].map( id => PlayerId.make( id ) );

const [ RED, BLUE ] = [ TeamId.make( "red" ), TeamId.make( "blue" ) ];

const config = buildConfig( 4, "NORMAL", 2 );

const ask = ( playerId: Player, from: Player, cardId: CardId, success: boolean ): Ask =>
	( { _tag: "fish/Ask", playerId, from, cardId, success } );

const known = (
	asks: readonly Ask[] = [],
	claims: readonly Claim[] = [],
	counts: Partial<Record<Player, number>> = {}
): PublicKnowledge => ( {
	cardCounts: { [ a ]: 13, [ b ]: 13, [ c ]: 13, [ d ]: 13, ...counts },
	moves: [ ...asks, ...claims ]
} );

// A real thirteen-card hand — four seats, fifty-two cards — so the counts and the
// hand describe the same table. The fitting has both margins to satisfy at once
// and cannot if they disagree.
const HAND: CardId[] = [
	"2H", "2C", "2S", "2D",
	"3H", "3C", "3S", "3D",
	"4H", "4C", "4S", "4D",
	"5H"
];

describe( "teamCountsFor", () => {
	test( "offers only the counts that split the seats evenly", () => {
		// Sides are equal-sized, so `initialize` refuses anything else — this is
		// what a client offers so that refusal never has to happen.
		expect( teamCountsFor( 4 ) ).toEqual( [ 2, 4 ] );
		expect( teamCountsFor( 6 ) ).toEqual( [ 2, 3 ] );
		expect( teamCountsFor( 8 ) ).toEqual( [ 2, 4 ] );
	} );

	test( "two sides always work, whatever the table seats", () => {
		for ( const count of [ 4, 6, 8 ] as const ) {
			expect( teamCountsFor( count ) ).toContain( 2 );
		}
	} );
} );

describe( "buildConfig", () => {
	test( "a normal table deals the whole deck when the seats divide it", () => {
		const built = buildConfig( 4, "NORMAL", 2 );

		expect( built.deckType ).toBe( 52 );
		expect( built.books ).toHaveLength( 13 );
		expect( built.bookSize ).toBe( 4 );
	} );

	test( "a normal table drops the sevens when they would not divide", () => {
		const built = buildConfig( 8, "NORMAL", 2 );

		expect( built.deckType ).toBe( 48 );
		expect( built.books ).not.toContain( "SEVENS" );
		expect( built.books ).toHaveLength( 12 );
	} );

	test( "a canadian table always plays forty-eight, in eight half-suits", () => {
		for ( const count of [ 4, 6, 8 ] as const ) {
			const built = buildConfig( count, "CANADIAN", 2 );

			expect( built.deckType ).toBe( 48 );
			expect( built.books ).toHaveLength( 8 );
			expect( built.bookSize ).toBe( 6 );
		}
	} );

	test( "the books always account for the whole deck", () => {
		for ( const type of [ "NORMAL", "CANADIAN" ] as const ) {
			for ( const count of [ 4, 6, 8 ] as const ) {
				const built = buildConfig( count, type, 2 );

				expect( built.books.length * built.bookSize ).toBe( built.deckType );
			}
		}
	} );

	test( "takes as many sides as it was asked for, in order", () => {
		expect( buildConfig( 6, "CANADIAN", 3 ).teams ).toHaveLength( 3 );
		expect( buildConfig( 4, "NORMAL", 2 ).teams ).toEqual( FISH_TEAMS.slice( 0, 2 ) );
	} );

	test( "a table starts by hand, so a lobby has time to pick sides", () => {
		expect( buildConfig( 4, "NORMAL", 2 ).autoStart ).toBe( false );
	} );
} );

describe( "getBookWinner", () => {
	const context = {
		players: [ a, b, c, d ],
		teams: { [ a ]: RED, [ b ]: BLUE, [ c ]: RED, [ d ]: BLUE }
	} as unknown as GameContext;

	const claim = (
		playerId: Player,
		success: boolean,
		correctClaim: Record<string, Player>
	): Claim =>
		( { _tag: "fish/Claim", success, playerId, book: "ACES", correctClaim, actualClaim: {} } );

	test( "a correct declaration wins the book for the declarer's side", () => {
		expect( getBookWinner( claim( a, true, {} ), context ) ).toBe( RED );
	} );

	test( "a wrong one gives it to whichever other side held most of it", () => {
		const held = { AH: b, AC: b, AS: b, AD: a };

		expect( getBookWinner( claim( a, false, held ), context ) ).toBe( BLUE );
	} );

	test( "a wrong one always costs the declarer's side the book, held or not", () => {
		// The declarer's own side held every card, and still loses it: a bad
		// declaration hands the book over rather than leaving it unawarded.
		const held = { AH: a, AC: c, AS: a, AD: c };

		expect( getBookWinner( claim( a, false, held ), context ) ).toBe( BLUE );
	} );

	test( "with more than two sides it goes to whichever held most of it", () => {
		const GREEN = TeamId.make( "green" );
		const threeWay = {
			players: [ a, b, c ],
			teams: { [ a ]: RED, [ b ]: BLUE, [ c ]: GREEN }
		} as unknown as GameContext;

		const held = { AH: c, AC: c, AS: b, AD: a };

		expect( getBookWinner( claim( a, false, held ), threeWay ) ).toBe( GREEN );
	} );

	test( "a game without sides has no side to award it to", () => {
		const sideless = { players: [ a, b ], teams: {} } as unknown as GameContext;

		expect( getBookWinner( claim( a, true, {} ), sideless ) ).toBeUndefined();
	} );
} );

describe( "getTeamScores", () => {
	const context = {
		players: [ a, b, c, d ],
		teams: { [ a ]: RED, [ b ]: BLUE, [ c ]: RED, [ d ]: BLUE }
	} as unknown as GameContext;

	const won = ( playerId: Player, book: NormalBook ): Claim =>
		( { _tag: "fish/Claim", success: true, playerId, book, correctClaim: {}, actualClaim: {} } );

	test( "counts the books each side took", () => {
		const scores = getTeamScores(
			[ won( a, "ACES" ), won( b, "TWOS" ), won( c, "THREES" ) ],
			context,
			[ RED, BLUE ]
		);

		expect( scores ).toEqual( { [ RED ]: 2, [ BLUE ]: 1 } );
	} );

	test( "a side that took none is reported at zero rather than omitted", () => {
		const scores = getTeamScores( [ won( a, "ACES" ) ], context, [ RED, BLUE ] );

		expect( scores[ BLUE ] ).toBe( 0 );
	} );

	test( "no declarations at all leave every side on nothing", () => {
		expect( getTeamScores( [], context, [ RED, BLUE ] ) ).toEqual( { [ RED ]: 0, [ BLUE ]: 0 } );
	} );
} );

describe( "the books still in play", () => {
	const claim = ( book: NormalBook ): Claim =>
		( { _tag: "fish/Claim", success: true, playerId: a, book, correctClaim: {}, actualClaim: {} } );

	test( "a fresh table has every book of its variant live", () => {
		expect( getLiveBooks( known(), config.books ) ).toEqual( config.books );
		expect( isGameComplete( known(), config.books ) ).toBe( false );
	} );

	test( "a declaration takes its book out, right or wrong", () => {
		const live = getLiveBooks( known( [], [ claim( "ACES" ) ] ), config.books );

		expect( live ).not.toContain( "ACES" );
		expect( live ).toHaveLength( config.books.length - 1 );
	} );

	test( "the table is played out once no book is left", () => {
		const all = config.books.map( book => claim( book as NormalBook ) );

		expect( isGameComplete( known( [], all ), config.books ) ).toBe( true );
	} );
} );

describe( "possibleHolders", () => {
	test( "starts with everyone holding cards, and only them", () => {
		const holders = possibleHolders( known( [], [], { [ d ]: 0 } ), config.books );

		expect( holders.get( "AH" ) ).toEqual( [ a, b, c ] );
		expect( holders.size ).toBe( config.books.length * config.bookSize );
	} );

	test( "a failed ask rules out both seats, for good", () => {
		const holders = possibleHolders( known( [ ask( a, b, "AH", false ) ] ), config.books );

		expect( holders.get( "AH" ) ).toEqual( [ c, d ] );
	} );

	test( "a successful ask pins the card to whoever asked", () => {
		const holders = possibleHolders( known( [ ask( a, b, "AH", true ) ] ), config.books );

		expect( holders.get( "AH" ) ).toEqual( [ a ] );
	} );

	test( "a refusal after a pin narrows it rather than undoing it", () => {
		// c asks a for the card a took off b, and misses — a must have passed it on.
		const holders = possibleHolders(
			known( [ ask( a, b, "AH", true ), ask( c, a, "AH", false ) ] ),
			config.books
		);

		expect( holders.get( "AH" ) ).toEqual( [] );
	} );

	test( "a declared book leaves play entirely", () => {
		const claim: Claim = {
			_tag: "fish/Claim",
			success: true,
			playerId: a,
			book: "ACES",
			correctClaim: {},
			actualClaim: {}
		};

		const holders = possibleHolders( known( [], [ claim ] ), config.books );

		expect( holders.get( "AH" ) ).toBeUndefined();
		expect( getLiveBooks( known( [], [ claim ] ), config.books ) ).not.toContain( "ACES" );
	} );
} );

describe( "getMetrics", () => {
	const claim = ( playerId: Player, book: NormalBook, success: boolean ): Claim =>
		( { _tag: "fish/Claim", success, playerId, book, correctClaim: {}, actualClaim: {} } );

	test( "counts both sides of every ask, and how declarations came out", () => {
		const metrics = getMetrics(
			known(
				[
					ask( a, b, "AH", true ),
					ask( a, b, "AC", false ),
					ask( c, a, "AH", true )
				],
				[ claim( a, "ACES", true ), claim( b, "TWOS", false ) ]
			),
			[ a, b, c, d ]
		);

		expect( metrics[ a ] ).toEqual( {
			totalAsks: 2,
			cardsTaken: 1,
			cardsGiven: 1,
			totalClaims: 1,
			successfulClaims: 1
		} );

		expect( metrics[ b ] ).toEqual( {
			totalAsks: 0,
			cardsTaken: 0,
			cardsGiven: 1,
			totalClaims: 1,
			successfulClaims: 0
		} );

		// A seat that never acted is reported, not omitted.
		expect( metrics[ d ] ).toEqual( {
			totalAsks: 0,
			cardsTaken: 0,
			cardsGiven: 0,
			totalClaims: 0,
			successfulClaims: 0
		} );
	} );

	test( "cards taken and cards given are the same cards, counted twice", () => {
		const asks = [ ask( a, b, "AH", true ), ask( c, d, "2H", true ), ask( a, c, "3H", false ) ];
		const metrics = getMetrics( known( asks ), [ a, b, c, d ] );

		const taken = Object.values( metrics ).reduce( ( sum, row ) => sum + row.cardsTaken, 0 );
		const given = Object.values( metrics ).reduce( ( sum, row ) => sum + row.cardsGiven, 0 );

		expect( taken ).toBe( given );
		expect( taken ).toBe( asks.filter( a => a.success ).length );
	} );
} );

describe( "beliefs", () => {
	const seat = ( hand: CardId[] = HAND ) => ( { playerId: a, hand, complete: true } );

	test( "a seat's own cards are proven, and nobody else can hold them", () => {
		const beliefs = buildBeliefs( known(), config, seat() );

		expect( beliefs.owner.get( "2H" ) ).toBe( a );
		expect( probability( beliefs, "2H", a ) ).toBe( 1 );
		expect( probability( beliefs, "2H", b ) ).toBe( 0 );
	} );

	test( "the table's own model proves nothing and spreads everything", () => {
		const beliefs = buildBeliefs( known(), config );

		expect( beliefs.self ).toBeUndefined();
		expect( beliefs.owner.size ).toBe( 0 );
		expect( probability( beliefs, "AH", a ) ).toBeCloseTo( 0.25, 6 );
	} );

	test( "every card's probabilities sum to one, and every hand's to its size", () => {
		const beliefs = buildBeliefs( known(), config, seat() );

		for ( const row of beliefs.prob.values() ) {
			const total = [ ...row.values() ].reduce( ( sum, value ) => sum + value, 0 );
			expect( total ).toBeCloseTo( 1, 6 );
		}

		// The column margin is what `holdsBookProbability` conditions on, so it has
		// to hold at the same time as the rows rather than merely nearly.
		for ( const [ pid, slots ] of beliefs.slots ) {
			let column = 0;
			for ( const row of beliefs.prob.values() ) {
				column = column + ( row.get( pid ) ?? 0 );
			}

			expect( column ).toBeCloseTo( slots, 6 );
		}
	} );

	test( "holding one card of a book makes another less likely, not independent", () => {
		const beliefs = buildBeliefs( known(), config, seat() );

		const cards: CardId[] = [ "AH", "AC", "AS", "AD" ];
		const independent = 1 - cards.reduce(
			( none, card ) => none * ( 1 - probability( beliefs, card, b ) ),
			1
		);

		const conditional = holdsBookProbability( beliefs, "ACES", b );

		// A hand of a fixed size makes the cards of a book compete for its slots, so
		// being in the book at all is likelier than independence would say.
		expect( conditional ).toBeGreaterThan( independent );
		expect( conditional ).toBeLessThanOrEqual( 1 );
	} );

	test( "a proven card of a book settles the question", () => {
		const beliefs = buildBeliefs( known(), config, seat( [ ...HAND.slice( 1 ), "AH" ] ) );

		expect( holdsBookProbability( beliefs, "ACES", a ) ).toBe( 1 );
	} );

	test( "a seat out of cards holds nothing", () => {
		const counts = { [ b ]: 19, [ c ]: 20, [ d ]: 0 };
		const beliefs = buildBeliefs( known( [], [], counts ), config, seat() );

		expect( probability( beliefs, "AC", d ) ).toBe( 0 );
		expect( holdsBookProbability( beliefs, "ACES", d ) ).toBe( 0 );
	} );
} );
