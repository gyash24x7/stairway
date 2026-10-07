import { assert, describe, it } from "@effect/vitest";

import type { Card, Cost, Noble, PlayerData, Tokens } from "@/games/splendor/schema";
import { SPLENDOR_MAX_RESERVED } from "@/games/splendor/schema";
import {
	bonusesFor,
	canPurchaseCard,
	costToString,
	DEFAULT_COST,
	DEFAULT_TOKENS,
	developmentCardCount,
	discountedCost,
	findOpenCard,
	findReservedCard,
	generateDecks,
	generateNobles,
	hasLegalMove,
	isValidPayment,
	paymentFor,
	qualifiesForNoble,
	qualifyingNobles,
	standingsFor,
	sumTokens
} from "@/games/splendor/utils";
import { makeRng } from "@/shared/utils/rng";
import type { PlayerId } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;

const cost = ( overrides: Partial<Cost> = {} ): Cost => ( { ...DEFAULT_COST, ...overrides } );
const tokens = ( overrides: Partial<Tokens> = {} ): Tokens => ( { ...DEFAULT_TOKENS, ...overrides } );

const card = ( overrides: Partial<Card> = {} ): Card => ( {
	id: "c1",
	level: 1,
	points: 0,
	bonus: "ruby",
	cost: cost(),
	...overrides
} );

const player = ( overrides: Partial<PlayerData> = {} ): PlayerData => ( {
	tokens: tokens(),
	cards: [],
	nobles: [],
	reserved: [],
	points: 0,
	...overrides
} );

const noble = ( requires: Partial<Cost> ): Noble => ( {
	id: "n1",
	points: 3,
	cost: cost( requires )
} );


describe( "splendor utils", () => {

	describe( "sumTokens", () => {

		it( "counts gold along with the gems", () => {
			assert.strictEqual( sumTokens( { diamond: 2, gold: 1 } ), 3 );
			assert.strictEqual( sumTokens( {} ), 0 );
		} );
	} );

	describe( "bonusesFor", () => {

		it( "counts one discount per card bought", () => {
			const bonuses = bonusesFor( [
				card( { bonus: "ruby" } ),
				card( { bonus: "ruby" } ),
				card( { bonus: "onyx" } )
			] );

			assert.strictEqual( bonuses.ruby, 2 );
			assert.strictEqual( bonuses.onyx, 1 );
			assert.strictEqual( bonuses.diamond, 0 );
		} );
	} );

	describe( "discountedCost", () => {

		it( "takes the discount off, gem by gem", () => {
			const target = card( { cost: cost( { ruby: 3, onyx: 1 } ) } );
			const discounted = discountedCost( target, [ card( { bonus: "ruby" } ) ] );

			assert.strictEqual( discounted.ruby, 2 );
			assert.strictEqual( discounted.onyx, 1 );
		} );

		it( "wastes a surplus discount rather than going negative", () => {
			const target = card( { cost: cost( { ruby: 1 } ) } );
			const owned = [ card( { bonus: "ruby" } ), card( { bonus: "ruby" } ) ];

			assert.strictEqual( discountedCost( target, owned ).ruby, 0 );
		} );
	} );

	describe( "paymentFor", () => {

		it( "spends gems first and gold only for the shortfall", () => {
			const target = card( { cost: cost( { ruby: 3 } ) } );
			const payment = paymentFor( target, tokens( { ruby: 2, gold: 2 } ), [] );

			assert.strictEqual( payment?.ruby, 2 );
			assert.strictEqual( payment?.gold, 1 );
		} );

		it( "spends no gold when the gems cover it", () => {
			const target = card( { cost: cost( { ruby: 2 } ) } );
			const payment = paymentFor( target, tokens( { ruby: 3, gold: 5 } ), [] );

			assert.strictEqual( payment?.ruby, 2 );
			assert.strictEqual( payment?.gold, 0 );
		} );

		it( "answers undefined when even the gold cannot cover it", () => {
			const target = card( { cost: cost( { ruby: 4 } ) } );
			assert.isUndefined( paymentFor( target, tokens( { ruby: 1, gold: 1 } ), [] ) );
		} );

		it( "prices the card after discounts", () => {
			const target = card( { cost: cost( { ruby: 3 } ) } );
			const payment = paymentFor( target, tokens( { ruby: 1 } ), [
				card( { bonus: "ruby" } ),
				card( { bonus: "ruby" } )
			] );

			assert.strictEqual( payment?.ruby, 1 );
			assert.strictEqual( payment?.gold, 0 );
		} );

		it( "agrees with canPurchaseCard", () => {
			const target = card( { cost: cost( { ruby: 4 } ) } );

			assert.isFalse( canPurchaseCard( target, tokens( { ruby: 1 } ), [] ) );
			assert.isTrue( canPurchaseCard( target, tokens( { ruby: 4 } ), [] ) );
		} );
	} );

	describe( "isValidPayment", () => {

		const target = card( { cost: cost( { ruby: 2, onyx: 1 } ) } );

		it( "accepts the exact price", () => {
			assert.isTrue( isValidPayment( target, { ruby: 2, onyx: 1 }, [] ) );
		} );

		it( "accepts gold covering the shortfall exactly", () => {
			assert.isTrue( isValidPayment( target, { ruby: 1, onyx: 1, gold: 1 }, [] ) );
			assert.isTrue( isValidPayment( target, { gold: 3 }, [] ) );
		} );

		it( "refuses overpaying a gem", () => {
			assert.isFalse( isValidPayment( target, { ruby: 3, onyx: 1 }, [] ) );
		} );

		it( "refuses underpaying", () => {
			assert.isFalse( isValidPayment( target, { ruby: 2 }, [] ) );
		} );

		it( "refuses gold that does not match the shortfall", () => {
			// No more, no less — so there is exactly one legal payment per split of
			// gems and gold, and none of them leaks value into the bank.
			assert.isFalse( isValidPayment( target, { ruby: 1, onyx: 1, gold: 2 }, [] ) );
			assert.isFalse( isValidPayment( target, { ruby: 1, onyx: 1 }, [] ) );
		} );

		it( "prices against the discounted cost", () => {
			const owned = [ card( { bonus: "ruby" } ) ];
			assert.isTrue( isValidPayment( target, { ruby: 1, onyx: 1 }, owned ) );
			assert.isFalse( isValidPayment( target, { ruby: 2, onyx: 1 }, owned ) );
		} );

		it( "accepts nothing at all for a fully discounted card", () => {
			const owned = [
				card( { bonus: "ruby" } ),
				card( { bonus: "ruby" } ),
				card( { bonus: "onyx" } )
			];
			assert.isTrue( isValidPayment( target, {}, owned ) );
		} );

		it( "says nothing about whether the seat holds it", () => {
			// Affordability is a separate question the move asks separately.
			assert.isTrue( isValidPayment( target, { ruby: 2, onyx: 1 }, [] ) );
		} );
	} );

	describe( "nobles", () => {

		it( "visits a seat whose bonuses meet the requirement", () => {
			const owned = [
				card( { bonus: "ruby" } ),
				card( { bonus: "ruby" } ),
				card( { bonus: "onyx" } )
			];

			assert.isTrue( qualifiesForNoble( owned, cost( { ruby: 2, onyx: 1 } ) ) );
			assert.isFalse( qualifiesForNoble( owned, cost( { ruby: 3 } ) ) );
		} );

		it( "counts bonuses, not tokens", () => {
			assert.isFalse( qualifiesForNoble( [], cost( { ruby: 1 } ) ) );
		} );

		it( "lists every noble willing to come, in table order", () => {
			// All of them rather than the first, because the rules give the choice to
			// the player when more than one qualifies.
			const owned = [ card( { bonus: "ruby" } ), card( { bonus: "ruby" } ) ];
			const nobles = [
				{ ...noble( { ruby: 2 } ), id: "a" },
				{ ...noble( { onyx: 3 } ), id: "b" },
				{ ...noble( { ruby: 1 } ), id: "c" }
			];

			assert.deepStrictEqual(
				qualifyingNobles( owned, nobles ).map( item => item.id ),
				[ "a", "c" ]
			);
		} );

		it( "draws one more noble than there are seats", () => {
			// Somebody always misses out.
			for ( const seats of [ 2, 3, 4 ] ) {
				const drawn = generateNobles( seats, makeRng( "nobles", seats ).next );
				assert.strictEqual( drawn.length, seats + 1, `for ${ seats } seats` );
			}
		} );

		it( "draws distinct nobles", () => {
			const drawn = generateNobles( 4, makeRng( "nobles" ).next );
			assert.strictEqual( new Set( drawn.map( item => item.id ) ).size, drawn.length );
		} );
	} );

	describe( "the decks", () => {

		it( "builds three levels of distinct cards", () => {
			const decks = generateDecks( makeRng( "decks" ).next );

			for ( const level of [ 1, 2, 3 ] as const ) {
				assert.isAbove( decks[ level ].length, 0, `level ${ level }` );
				assert.strictEqual(
					new Set( decks[ level ].map( item => item.id ) ).size,
					decks[ level ].length
				);
			}
		} );

		it( "keeps every card at the level it was built for", () => {
			const decks = generateDecks( makeRng( "decks" ).next );
			for ( const level of [ 1, 2, 3 ] as const ) {
				for ( const item of decks[ level ] ) {
					assert.strictEqual( item.level, level );
				}
			}
		} );

		it( "deals the same decks for the same seed", () => {
			assert.deepStrictEqual(
				generateDecks( makeRng( "same" ).next )[ 1 ].map( item => item.id ),
				generateDecks( makeRng( "same" ).next )[ 1 ].map( item => item.id )
			);
		} );
	} );

	describe( "costToString", () => {

		it( "spells a price out so two identical cards share an id", () => {
			// Nothing random goes into it, so an id survives a replay unchanged.
			assert.strictEqual(
				costToString( cost( { ruby: 2, onyx: 1 } ) ),
				costToString( cost( { onyx: 1, ruby: 2 } ) )
			);
			assert.notStrictEqual(
				costToString( cost( { ruby: 2 } ) ),
				costToString( cost( { ruby: 3 } ) )
			);
		} );
	} );

	describe( "finding a card", () => {

		const rows = {
			1: [ card( { id: "a" } ) ],
			2: [ card( { id: "b", level: 2 as const } ) ],
			3: [] as ReadonlyArray<Card>
		};

		it( "looks through every row", () => {
			assert.strictEqual( findOpenCard( "a", rows )?.id, "a" );
			assert.strictEqual( findOpenCard( "b", rows )?.id, "b" );
			assert.isUndefined( findOpenCard( "z", rows ) );
		} );

		it( "looks through a seat's own reserve", () => {
			const seat = player( { reserved: [ card( { id: "r" } ) ] } );
			assert.strictEqual( findReservedCard( "r", seat )?.id, "r" );
			assert.isUndefined( findReservedCard( "a", seat ) );
		} );
	} );

	describe( "hasLegalMove", () => {

		const emptyBoard = { tokens: tokens(), cards: { 1: [], 2: [], 3: [] } };

		it( "is true while one gem is left in the bank", () => {
			// The ten-token limit never blocks it: a seat at ten takes and hands the
			// same tokens straight back.
			const table = { ...emptyBoard, tokens: tokens( { ruby: 1 } ) };
			assert.isTrue( hasLegalMove( table, player( { tokens: tokens( { ruby: 10 } ) } ) ) );
		} );

		it( "ignores gold — it is only ever taken with a reservation", () => {
			const table = { ...emptyBoard, tokens: tokens( { gold: 5 } ) };
			assert.isFalse( hasLegalMove( table, player() ) );
		} );

		it( "is true while a card is face up and the reserve has room", () => {
			const table = { ...emptyBoard, cards: { 1: [ card() ], 2: [], 3: [] } };
			assert.isTrue( hasLegalMove( table, player() ) );
		} );

		it( "is false once the reserve is full and nothing is affordable", () => {
			const table = {
				...emptyBoard,
				cards: { 1: [ card( { id: "x", cost: cost( { ruby: 5 } ) } ) ], 2: [], 3: [] }
			};

			const seat = player( {
				reserved: Array.from( { length: SPLENDOR_MAX_RESERVED }, ( _, i ) =>
					card( { id: `r${ i }`, cost: cost( { ruby: 5 } ) } ) )
			} );

			assert.isFalse( hasLegalMove( table, seat ) );
		} );

		it( "is true when a reserved card is affordable", () => {
			const seat = player( {
				tokens: tokens( { ruby: 5 } ),
				reserved: Array.from( { length: SPLENDOR_MAX_RESERVED }, ( _, i ) =>
					card( { id: `r${ i }`, cost: cost( { ruby: 5 } ) } ) )
			} );

			assert.isTrue( hasLegalMove( emptyBoard, seat ) );
		} );

		it( "is false on a table with nothing left at all", () => {
			// `false` is what makes `pass` legal, and it is a shared condition rather
			// than a personal one.
			assert.isFalse( hasLegalMove( emptyBoard, player() ) );
		} );
	} );

	describe( "standings", () => {

		const scored = ( points: number, cards: number ) => player( {
			points,
			cards: Array.from( { length: cards }, ( _, i ) => card( { id: `c${ i }` } ) )
		} );

		it( "counts a seat's development cards", () => {
			assert.strictEqual( developmentCardCount( scored( 5, 3 ) ), 3 );
			assert.strictEqual( developmentCardCount( undefined ), 0 );
		} );

		it( "ranks on prestige first", () => {
			const { ranking, winner } = standingsFor( [ alice, bob ], {
				[ alice ]: scored( 12, 3 ),
				[ bob ]: scored( 15, 9 )
			} );

			assert.strictEqual( winner, bob );
			assert.deepStrictEqual(
				ranking.map( s => [ s.playerId, s.rank ] ),
				[ [ bob, 1 ], [ alice, 2 ] ]
			);
		} );

		it( "breaks a tie in favour of fewer cards", () => {
			// The printed tie-break: getting there with less is better.
			const { winner } = standingsFor( [ alice, bob ], {
				[ alice ]: scored( 15, 8 ),
				[ bob ]: scored( 15, 12 )
			} );

			assert.strictEqual( winner, alice );
		} );

		it( "names no winner when two seats are level on both", () => {
			const { ranking, winner } = standingsFor( [ alice, bob, carol ], {
				[ alice ]: scored( 15, 8 ),
				[ bob ]: scored( 15, 8 ),
				[ carol ]: scored( 3, 2 )
			} );

			assert.isUndefined( winner );
			assert.deepStrictEqual( ranking.map( s => s.rank ), [ 1, 1, 3 ] );
		} );

		it( "carries each seat's prestige on its standing", () => {
			const { ranking } = standingsFor( [ alice ], { [ alice ]: scored( 12, 3 ) } );
			assert.strictEqual( ranking[ 0 ]?.score, 12 );
		} );
	} );
} );
