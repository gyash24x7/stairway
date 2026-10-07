import { assert, describe, it } from "@effect/vitest";

import type { Trick } from "@/games/callbreak/schema";
import {
	activeDealOf,
	activeTrickOf,
	getCardValue,
	getHighestCardValue,
	getPlayableCards,
	getTrickWinner,
	isScored,
	RANK_ORDER,
	scoreDeal,
	trickPlayOrder
} from "@/games/callbreak/utils";
import type { CardId } from "@/shared/utils/cards";
import type { PlayerId } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;
const dave = "dave" as PlayerId;

const SEATS = [ alice, bob, carol, dave ];

const trick = ( overrides: Partial<Trick> = {} ): Trick => ( {
	leadPlayer: alice,
	cards: {},
	...overrides
} );

const cards = ( ...entries: ReadonlyArray<[ PlayerId, CardId ]> ) =>
	Object.fromEntries( entries ) as Record<PlayerId, CardId>;


describe( "callbreak utils", () => {

	describe( "getCardValue", () => {

		it( "ranks two lowest and ace highest", () => {
			assert.strictEqual( getCardValue( "2H" ), 0 );
			assert.strictEqual( getCardValue( "AH" ), RANK_ORDER.length - 1 );
		} );

		it( "puts the picture cards above the ten", () => {
			assert.isAbove( getCardValue( "JH" ), getCardValue( "10H" ) );
			assert.isAbove( getCardValue( "QH" ), getCardValue( "JH" ) );
			assert.isAbove( getCardValue( "KH" ), getCardValue( "QH" ) );
			assert.isAbove( getCardValue( "AH" ), getCardValue( "KH" ) );
		} );

		it( "ignores the suit — a rank is a rank", () => {
			assert.strictEqual( getCardValue( "KH" ), getCardValue( "KS" ) );
		} );
	} );

	describe( "getHighestCardValue", () => {

		it( "reads the best card of the suit asked for", () => {
			assert.strictEqual(
				getHighestCardValue( [ "2H", "KH", "AS" ], "H" ),
				getCardValue( "KH" )
			);
		} );

		it( "answers -1 when the suit is absent", () => {
			assert.strictEqual( getHighestCardValue( [ "2H", "KH" ], "S" ), -1 );
		} );

		it( "answers -1 for an empty trick", () => {
			assert.strictEqual( getHighestCardValue( [], "H" ), -1 );
		} );
	} );

	describe( "trickPlayOrder", () => {

		it( "starts at the seat that led, not at the seat that sits first", () => {
			// Every trick but one starts wherever the last was won, so seat order is
			// not play order — and the lead card decides what everyone else may follow.
			assert.deepStrictEqual(
				trickPlayOrder( trick( { leadPlayer: carol } ), SEATS ),
				[ carol, dave, alice, bob ]
			);
		} );

		it( "leaves the order alone when the first seat leads", () => {
			assert.deepStrictEqual( trickPlayOrder( trick(), SEATS ), SEATS );
		} );

		it( "falls back to seat order for a leader who is not seated", () => {
			assert.deepStrictEqual(
				trickPlayOrder( trick( { leadPlayer: "nobody" as PlayerId } ), SEATS ),
				SEATS
			);
		} );
	} );

	describe( "getPlayableCards — the strict rule", () => {

		const hand: ReadonlyArray<CardId> = [ "2H", "KH", "5H", "3S", "AS", "7C" ];

		it( "lets the leader play anything", () => {
			assert.deepStrictEqual( getPlayableCards( hand, "S", trick() ), [ ...hand ] );
		} );

		it( "lets a seat play anything into a trick with no suit yet", () => {
			const open = trick( { cards: {} } );
			assert.deepStrictEqual( getPlayableCards( hand, "S", open ), [ ...hand ] );
		} );

		it( "requires following suit and heading the trick", () => {
			// 4H led: only a heart above the four will do.
			const led = trick( { suit: "H", cards: cards( [ alice, "4H" ] ) } );
			assert.deepStrictEqual( getPlayableCards( hand, "S", led ), [ "KH", "5H" ] );
		} );

		it( "falls back to any card of the suit when none can head it", () => {
			const led = trick( { suit: "H", cards: cards( [ alice, "AH" ] ) } );
			assert.deepStrictEqual( getPlayableCards( hand, "S", led ), [ "2H", "KH", "5H" ] );
		} );

		it( "only asks a seat to follow once a trump has taken the trick away", () => {
			// Hearts led, a spade already down: heading the hearts is pointless, so
			// following suit is all that is left to do.
			const trumped = trick( {
				suit: "H",
				cards: cards( [ alice, "4H" ], [ bob, "2S" ] )
			} );

			assert.deepStrictEqual( getPlayableCards( hand, "S", trumped ), [ "2H", "KH", "5H" ] );
		} );

		it( "still makes a seat head a trump-led trick", () => {
			// Trump is the led suit, so the trump-already-down shortcut does not apply.
			const trumpHand: ReadonlyArray<CardId> = [ "2S", "KS", "5S", "3H" ];
			const led = trick( { suit: "S", cards: cards( [ alice, "4S" ] ) } );

			assert.deepStrictEqual( getPlayableCards( trumpHand, "S", led ), [ "KS", "5S" ] );
		} );

		it( "makes a void seat trump when it holds one", () => {
			const voidHand: ReadonlyArray<CardId> = [ "3S", "AS", "7C", "9D" ];
			const led = trick( { suit: "H", cards: cards( [ alice, "4H" ] ) } );

			assert.deepStrictEqual( getPlayableCards( voidHand, "S", led ), [ "3S", "AS" ] );
		} );

		it( "makes it overtrump when a trump is already down", () => {
			const voidHand: ReadonlyArray<CardId> = [ "3S", "AS", "7C" ];
			const led = trick( {
				suit: "H",
				cards: cards( [ alice, "4H" ], [ bob, "5S" ] )
			} );

			assert.deepStrictEqual( getPlayableCards( voidHand, "S", led ), [ "AS" ] );
		} );

		it( "frees a seat that cannot overtrump to throw anything", () => {
			const voidHand: ReadonlyArray<CardId> = [ "3S", "7C", "9D" ];
			const led = trick( {
				suit: "H",
				cards: cards( [ alice, "4H" ], [ bob, "AS" ] )
			} );

			assert.deepStrictEqual( getPlayableCards( voidHand, "S", led ), [ ...voidHand ] );
		} );

		it( "frees a seat void in both to play anything", () => {
			const voidHand: ReadonlyArray<CardId> = [ "7C", "9D" ];
			const led = trick( { suit: "H", cards: cards( [ alice, "4H" ] ) } );

			assert.deepStrictEqual( getPlayableCards( voidHand, "S", led ), [ ...voidHand ] );
		} );

		it( "never offers a card the hand does not hold", () => {
			const led = trick( { suit: "H", cards: cards( [ alice, "4H" ] ) } );
			for ( const card of getPlayableCards( hand, "S", led ) ) {
				assert.include( hand, card );
			}
		} );
	} );

	describe( "getTrickWinner", () => {

		it( "has no winner for an empty trick", () => {
			assert.isUndefined( getTrickWinner( trick(), "S" ) );
		} );

		it( "gives it to the highest card of the led suit", () => {
			const played = trick( {
				suit: "H",
				cards: cards( [ alice, "4H" ], [ bob, "KH" ], [ carol, "9H" ], [ dave, "2H" ] )
			} );

			assert.strictEqual( getTrickWinner( played, "S" ), bob );
		} );

		it( "lets a trump beat every plain card, whatever was led", () => {
			const played = trick( {
				suit: "H",
				cards: cards( [ alice, "AH" ], [ bob, "KH" ], [ carol, "2S" ], [ dave, "QH" ] )
			} );

			assert.strictEqual( getTrickWinner( played, "S" ), carol );
		} );

		it( "gives it to the highest trump when several are down", () => {
			const played = trick( {
				suit: "H",
				cards: cards( [ alice, "AH" ], [ bob, "2S" ], [ carol, "KS" ], [ dave, "5S" ] )
			} );

			assert.strictEqual( getTrickWinner( played, "S" ), carol );
		} );

		it( "never gives it to a discard of a third suit", () => {
			// A card of neither the led suit nor trump cannot win — that is precisely
			// what makes a discard a discard.
			const played = trick( {
				suit: "H",
				cards: cards( [ alice, "4H" ], [ bob, "AC" ], [ carol, "AD" ], [ dave, "2H" ] )
			} );

			assert.oneOf( getTrickWinner( played, "S" ), [ alice, dave ] );
			assert.strictEqual( getTrickWinner( played, "S" ), alice );
		} );

		it( "reads the led suit off the first card when the trick has none set", () => {
			const played = trick( { cards: cards( [ alice, "4H" ], [ bob, "AC" ] ) } );
			assert.strictEqual( getTrickWinner( played, "S" ), alice );
		} );

		it( "answers a partial trick", () => {
			const played = trick( { suit: "H", cards: cards( [ alice, "4H" ], [ bob, "KH" ] ) } );
			assert.strictEqual( getTrickWinner( played, "S" ), bob );
		} );
	} );

	describe( "scoreDeal", () => {

		const declarations = ( entries: Record<string, number> ) =>
			entries as Record<PlayerId, number>;

		it( "pays a made contract its call, in tenths", () => {
			const scores = scoreDeal(
				SEATS,
				declarations( { alice: 3, bob: 3, carol: 3, dave: 4 } ),
				declarations( { alice: 3, bob: 3, carol: 3, dave: 4 } )
			);

			assert.strictEqual( scores[ alice ], 30 );
			assert.strictEqual( scores[ dave ], 40 );
		} );

		it( "pays a tenth for each trick beyond the call", () => {
			const scores = scoreDeal(
				SEATS,
				declarations( { alice: 3 } ),
				declarations( { alice: 5 } )
			);

			assert.strictEqual( scores[ alice ], 32 );
		} );

		it( "charges the whole call when the contract breaks", () => {
			const scores = scoreDeal(
				SEATS,
				declarations( { alice: 4 } ),
				declarations( { alice: 3 } )
			);

			assert.strictEqual( scores[ alice ], -40 );
		} );

		it( "charges the call, not the shortfall", () => {
			const one = scoreDeal( SEATS, declarations( { alice: 4 } ), declarations( { alice: 3 } ) );
			const none = scoreDeal( SEATS, declarations( { alice: 4 } ), declarations( { alice: 0 } ) );

			assert.strictEqual( one[ alice ], none[ alice ] );
		} );

		it( "never charges a seat that did not call", () => {
			// `0` is the sentinel for "has not called", so it can never break a
			// contract — the penalty is the call, and the call is nothing.
			const scores = scoreDeal( SEATS, declarations( {} ), declarations( { alice: 0 } ) );
			assert.strictEqual( scores[ alice ], 0 );

			const lucky = scoreDeal( SEATS, declarations( {} ), declarations( { alice: 5 } ) );
			assert.isAtLeast( lucky[ alice ]!, 0 );
		} );

		it( "scores every seat at the table", () => {
			const scores = scoreDeal( SEATS, declarations( {} ), declarations( {} ) );
			assert.deepStrictEqual( Object.keys( scores ).sort(), [ ...SEATS ].sort() );
		} );

		it( "keeps totals exact by staying in tenths", () => {
			// Three overtricks in a row is 0.3 of a point; in floating point that is
			// not 0.3, which is why the running total is an integer count of tenths.
			const deal = scoreDeal( SEATS, declarations( { alice: 1 } ), declarations( { alice: 2 } ) );
			assert.strictEqual( deal[ alice ]! * 3, 33 );
		} );
	} );

	describe( "reading the state", () => {

		it( "takes the deal and the trick in play off the head", () => {
			// Both lists are kept newest-first.
			const state = {
				deals: [
					{ id: "deal-2", tricks: [ { leadPlayer: bob, cards: {} } ] },
					{ id: "deal-1", tricks: [] }
				],
				scores: {}
			} as never;

			const deal = activeDealOf( state );
			assert.strictEqual( deal?.id, "deal-2" );
			assert.strictEqual( activeTrickOf( deal )?.leadPlayer, bob );
		} );

		it( "has no active deal before the first is cut", () => {
			assert.isUndefined( activeDealOf( { deals: [], scores: {} } as never ) );
			assert.isUndefined( activeTrickOf( undefined ) );
		} );

		it( "calls a deal scored once its scores are filled in", () => {
			// Emptiness is the only marker the state carries, and unlike a trick
			// count it survives the next deal being dealt on top.
			assert.isFalse( isScored( { scores: {} } as never ) );
			assert.isTrue( isScored( { scores: { [ alice ]: 30 } } as never ) );
		} );
	} );
} );
