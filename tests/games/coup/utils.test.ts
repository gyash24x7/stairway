import { assert, describe, it } from "@effect/vitest";

import type { CoupCard, CoupState, CoupView } from "@/games/coup/schema";
import { COUP_CARD_COPIES, COUP_CHARACTERS } from "@/games/coup/schema";
import {
	aliveOf,
	aliveOthers,
	buildDeck,
	byKeepValue,
	coinsOf,
	handOf,
	holds,
	influenceOf,
	isAlive,
	isProvableBluff,
	isSubMultiset,
	remainderOf,
	visibleCopies,
	withoutOne
} from "@/games/coup/utils";
import type { GameContext, PlayerId } from "@/swish/schema";
import { GameContext as Context } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;

const context: GameContext = Context.make( {
	turn: 0,
	players: [ alice, bob, carol ],
	teams: {},
	teamNames: {},
	interactions: [],
	interactionCount: 0
} );

const state = ( overrides: Partial<CoupState> = {} ): CoupState => ( {
	deck: [],
	hands: {},
	lost: {},
	coins: {},
	eliminated: [],
	drawn: {},
	...overrides
} );

const view = ( overrides: Partial<CoupView> = {} ): CoupView => ( {
	hand: [],
	drawn: [],
	lost: [],
	influence: {},
	coins: {},
	eliminated: [],
	deckSize: 0,
	...overrides
} );


describe( "coup utils", () => {

	describe( "buildDeck", () => {

		it( "holds four of each character, twenty in all", () => {
			const deck = buildDeck();
			assert.strictEqual( deck.length, COUP_CHARACTERS.length * COUP_CARD_COPIES );

			for ( const card of COUP_CHARACTERS ) {
				assert.strictEqual(
					deck.filter( held => held === card ).length,
					COUP_CARD_COPIES,
					card
				);
			}
		} );
	} );

	describe( "reading the table", () => {

		it( "reads an absent hand as empty rather than unknown", () => {
			assert.deepStrictEqual( handOf( state(), alice ), [] );
			assert.strictEqual( influenceOf( state(), alice ), 0 );
		} );

		it( "reads absent coins as none", () => {
			assert.strictEqual( coinsOf( state(), alice ), 0 );
			assert.strictEqual( coinsOf( state( { coins: { [ alice ]: 3 } } ), alice ), 3 );
		} );

		it( "counts somebody out once they are in `eliminated`", () => {
			assert.isTrue( isAlive( state(), alice ) );
			assert.isFalse( isAlive( state( { eliminated: [ alice ] } ), alice ) );
		} );

		it( "keeps the living in seat order", () => {
			const alive = aliveOf( state( { eliminated: [ bob ] } ), context );
			assert.deepStrictEqual( alive, [ alice, carol ] );
		} );

		it( "never asks a player about their own claim, nor anybody who is out", () => {
			const others = aliveOthers( state( { eliminated: [ carol ] } ), context, alice );
			assert.deepStrictEqual( others, [ bob ] );
		} );

		it( "knows what a player is holding", () => {
			const table = state( { hands: { [ alice ]: [ "DUKE", "CAPTAIN" ] } } );
			assert.isTrue( holds( table, alice, "DUKE" ) );
			assert.isFalse( holds( table, alice, "CONTESSA" ) );
		} );
	} );

	describe( "withoutOne", () => {

		it( "takes exactly one copy, and leaves the other", () => {
			assert.deepStrictEqual(
				withoutOne( [ "DUKE", "DUKE" ], "DUKE" ),
				[ "DUKE" ]
			);
		} );

		it( "leaves a list that never held the card alone", () => {
			assert.deepStrictEqual(
				withoutOne( [ "DUKE", "CAPTAIN" ], "CONTESSA" ),
				[ "DUKE", "CAPTAIN" ]
			);
		} );

		it( "does not mutate its input", () => {
			const hand: ReadonlyArray<CoupCard> = [ "DUKE", "CAPTAIN" ];
			withoutOne( hand, "DUKE" );
			assert.deepStrictEqual( hand, [ "DUKE", "CAPTAIN" ] );
		} );
	} );

	describe( "isSubMultiset", () => {

		it( "accepts what the pool can cover", () => {
			assert.isTrue( isSubMultiset( [ "DUKE", "DUKE", "CAPTAIN" ], [ "DUKE", "CAPTAIN" ] ) );
		} );

		it( "counts duplicates rather than membership", () => {
			assert.isTrue( isSubMultiset( [ "DUKE", "DUKE" ], [ "DUKE", "DUKE" ] ) );
			assert.isFalse( isSubMultiset( [ "DUKE" ], [ "DUKE", "DUKE" ] ) );
		} );

		it( "accepts taking nothing", () => {
			assert.isTrue( isSubMultiset( [], [] ) );
		} );

		it( "refuses a card the pool never held", () => {
			assert.isFalse( isSubMultiset( [ "DUKE" ], [ "CONTESSA" ] ) );
		} );
	} );

	describe( "remainderOf", () => {

		it( "gives back what was not kept", () => {
			assert.deepStrictEqual(
				remainderOf( [ "DUKE", "CAPTAIN", "CONTESSA" ], [ "CAPTAIN" ] ),
				[ "DUKE", "CONTESSA" ]
			);
		} );

		it( "removes one copy per card kept", () => {
			assert.deepStrictEqual(
				remainderOf( [ "DUKE", "DUKE", "DUKE" ], [ "DUKE", "DUKE" ] ),
				[ "DUKE" ]
			);
		} );

		it( "is the exact complement of what `isSubMultiset` accepted", () => {
			const pool: ReadonlyArray<CoupCard> = [ "DUKE", "DUKE", "CAPTAIN", "ASSASSIN" ];
			const kept: ReadonlyArray<CoupCard> = [ "DUKE", "ASSASSIN" ];

			assert.isTrue( isSubMultiset( pool, kept ) );
			assert.strictEqual( remainderOf( pool, kept ).length, pool.length - kept.length );
		} );
	} );

	describe( "visibleCopies", () => {

		it( "counts the hand and the exchange draw together", () => {
			assert.strictEqual(
				visibleCopies( view( { hand: [ "DUKE" ], drawn: [ "DUKE", "CAPTAIN" ] } ), "DUKE" ),
				2
			);
		} );

		it( "deliberately ignores what this seat has lost", () => {
			// A surrendered card goes back into the deck rather than face up, so it
			// is not out of the game and cannot be counted against a claim.
			assert.strictEqual(
				visibleCopies( view( { hand: [], lost: [ "DUKE", "DUKE" ] } ), "DUKE" ),
				0
			);
		} );
	} );

	describe( "isProvableBluff", () => {

		it( "is true only when this seat holds every copy there is", () => {
			const all: ReadonlyArray<CoupCard> = Array.from(
				{ length: COUP_CARD_COPIES },
				() => "DUKE" as const
			);

			assert.isTrue( isProvableBluff( view( { hand: all } ), "DUKE" ) );
			assert.isFalse( isProvableBluff( view( { hand: all.slice( 1 ) } ), "DUKE" ) );
		} );

		it( "is false for a seat holding nothing", () => {
			assert.isFalse( isProvableBluff( view(), "DUKE" ) );
		} );
	} );

	describe( "byKeepValue", () => {

		it( "puts the Duke first and the Ambassador last", () => {
			assert.deepStrictEqual(
				byKeepValue( [ "AMBASSADOR", "DUKE", "CONTESSA", "CAPTAIN", "ASSASSIN" ] ),
				[ "DUKE", "CAPTAIN", "ASSASSIN", "CONTESSA", "AMBASSADOR" ]
			);
		} );

		it( "does not mutate its input", () => {
			const hand: ReadonlyArray<CoupCard> = [ "AMBASSADOR", "DUKE" ];
			byKeepValue( hand );
			assert.deepStrictEqual( hand, [ "AMBASSADOR", "DUKE" ] );
		} );
	} );
} );
