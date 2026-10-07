import { assert, describe, it } from "@effect/vitest";

import { atPosition } from "@tests/harness/position";

import type { CallbreakConfig, CallbreakState, Deal } from "@/games/callbreak/schema";
import { CALLBREAK_TRICKS_PER_DEAL, CallbreakConfig as Config } from "@/games/callbreak/schema";
import { CallbreakStructure } from "@/games/callbreak/server/engine";
import type { CardId } from "@/shared/utils/cards";
import type { PlayerId } from "@/swish/schema";
import { PlayerAudience, TableAudience } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;
const dave = "dave" as PlayerId;

const SEATS = [ alice, bob, carol, dave ];

const config = ( overrides: Partial<CallbreakConfig> = {} ): CallbreakConfig => Config.make( {
	playerCount: 4,
	autoStart: true,
	dealCount: 5,
	trumpSuit: "S",
	botDelayMillis: 5_000,
	...overrides
} );

const deal = ( overrides: Partial<Deal> = {} ): Deal => ( {
	id: "deal-1",
	startingPlayer: alice,
	hands: {
		[ alice ]: [ "2H", "KH", "5H", "3S", "AS", "7C" ],
		[ bob ]: [ "4H", "AH", "2S", "9C", "3D", "JD" ],
		[ carol ]: [ "7H", "8H", "KS", "5C", "6D", "QD" ],
		[ dave ]: [ "9H", "10H", "QS", "AC", "2D", "KD" ]
	},
	declarations: Object.fromEntries( SEATS.map( seat => [ seat, 0 ] ) ) as Record<PlayerId, number>,
	wins: Object.fromEntries( SEATS.map( seat => [ seat, 0 ] ) ) as Record<PlayerId, number>,
	scores: {},
	tricks: [],
	...overrides
} );

const at = (
	state: Partial<CallbreakState> = {},
	phase = "declaring",
	current: PlayerId = alice,
	overrides: Partial<CallbreakConfig> = {}
) => atPosition( CallbreakStructure, {
	state: { deals: [ deal() ], scores: {}, ...state },
	config: config( overrides ),
	context: { players: SEATS, currentPlayer: current, phase, turn: 0 }
} );

const tags = ( events: ReadonlyArray<unknown> ) =>
	events.map( event => ( event as { _tag: string } )._tag );

/** A deal in which every seat has called, so the playing phase is reachable. */
const called = ( overrides: Partial<Deal> = {} ) => deal( {
	declarations: Object.fromEntries(
		SEATS.map( seat => [ seat, 3 ] )
	) as Record<PlayerId, number>,
	...overrides
} );


describe( "callbreak rules", () => {

	describe( "onStart", () => {

		it( "seeds a running total for every seat, and deals nothing", () => {
			// The cards are cut by the declaring phase's `onEnter`, so there is only
			// ever one place a deal is dealt.
			const game = at( { deals: [] } );
			const events = game.onStart();

			assert.deepStrictEqual(
				tags( events ),
				Array.from( { length: 4 }, () => "callbreak/ev/ScoreInitialized" )
			);

			game.apply( ...events );
			assert.deepStrictEqual( { ...game.state.scores }, { alice: 0, bob: 0, carol: 0, dave: 0 } );
		} );
	} );

	describe( "declareWins", () => {

		it( "accepts a call inside the range", () => {
			assert.isUndefined( at().validate( "declareWins", alice, { wins: 3, dealId: "deal-1" } ) );
			assert.isUndefined( at().validate( "declareWins", alice, { wins: 1, dealId: "deal-1" } ) );
			assert.isUndefined( at().validate( "declareWins", alice, { wins: 13, dealId: "deal-1" } ) );
		} );

		it( "refuses a call naming a deal that is not in play", () => {
			const invalid = at().validate( "declareWins", alice, { wins: 3, dealId: "deal-9" } );
			assert.include( invalid?.reason ?? "", "not the one in play" );
		} );

		it( "refuses a call with no deal at all", () => {
			const game = at( { deals: [] } );
			assert.isDefined( game.validate( "declareWins", alice, { wins: 3, dealId: "deal-1" } ) );
		} );

		it( "refuses a second call for the same deal", () => {
			const game = at();
			game.play( "declareWins", alice, { wins: 3, dealId: "deal-1" } );

			const invalid = game.validate( "declareWins", alice, { wins: 4, dealId: "deal-1" } );
			assert.include( invalid?.reason ?? "", "already declared" );
		} );

		it( "refuses a call outside the range", () => {
			const low = at().validate( "declareWins", alice, { wins: 0, dealId: "deal-1" } );
			const high = at().validate( "declareWins", alice, { wins: 14, dealId: "deal-1" } );

			assert.include( low?.reason ?? "", "between 1 and 13" );
			assert.include( high?.reason ?? "", "between 1 and 13" );
		} );

		it( "records the call against the deal in play", () => {
			const game = at();
			game.play( "declareWins", bob, { wins: 5, dealId: "deal-1" } );

			assert.strictEqual( game.state.deals[ 0 ]?.declarations[ bob ], 5 );
			assert.strictEqual( game.state.deals[ 0 ]?.declarations[ alice ], 0 );
		} );
	} );

	describe( "playCard", () => {

		const playing = ( overrides: Partial<Deal> = {}, current: PlayerId = alice ) => at(
			{ deals: [ called( { tricks: [ { leadPlayer: alice, cards: {} } ], ...overrides } ) ] },
			"playing",
			current
		);

		it( "accepts a legal lead", () => {
			assert.isUndefined( playing()
				.validate( "playCard", alice, { cardId: "2H", dealId: "deal-1" } ) );
		} );

		it( "refuses a card naming the wrong deal", () => {
			const invalid = playing().validate( "playCard", alice, { cardId: "2H", dealId: "deal-2" } );
			assert.include( invalid?.reason ?? "", "not the one in play" );
		} );

		it( "refuses a card when no trick is open", () => {
			const game = at( { deals: [ called( { tricks: [] } ) ] }, "playing" );
			const invalid = game.validate( "playCard", alice, { cardId: "2H", dealId: "deal-1" } );
			assert.include( invalid?.reason ?? "", "No trick is in play" );
		} );

		it( "refuses a second card into the same trick", () => {
			const game = playing( {
				tricks: [ { leadPlayer: alice, suit: "H", cards: { [ alice ]: "2H" } } ]
			} );

			const invalid = game.validate( "playCard", alice, { cardId: "KH", dealId: "deal-1" } );
			assert.include( invalid?.reason ?? "", "already played into this trick" );
		} );

		it( "refuses a card the seat does not hold", () => {
			const invalid = playing().validate( "playCard", alice, { cardId: "AD", dealId: "deal-1" } );
			assert.include( invalid?.reason ?? "", "do not hold that card" );
		} );

		it( "refuses following low when the trick can be headed", () => {
			const game = playing( {
				tricks: [ { leadPlayer: bob, suit: "H", cards: { [ bob ]: "4H" } } ]
			}, alice );

			const invalid = game.validate( "playCard", alice, { cardId: "2H", dealId: "deal-1" } );
			assert.include( invalid?.reason ?? "", "follow suit and head the trick" );

			assert.isUndefined( game.validate( "playCard", alice, { cardId: "KH", dealId: "deal-1" } ) );
		} );

		it( "refuses a discard while the seat still holds the suit", () => {
			const game = playing( {
				tricks: [ { leadPlayer: bob, suit: "H", cards: { [ bob ]: "4H" } } ]
			}, alice );

			assert.isDefined( game.validate( "playCard", alice, { cardId: "7C", dealId: "deal-1" } ) );
		} );

		it( "records the card, the led suit and the seat's shrinking hand", () => {
			const game = playing();
			game.play( "playCard", alice, { cardId: "KH", dealId: "deal-1" } );

			const trick = game.state.deals[ 0 ]?.tricks[ 0 ];
			assert.strictEqual( trick?.cards[ alice ], "KH" );
			assert.strictEqual( trick?.suit, "H", "read off the first card, not carried on the event" );
			assert.notInclude( [ ...game.state.deals[ 0 ]!.hands[ alice ]! ], "KH" );
		} );

		it( "emits only the card until the trick is full", () => {
			const events = playing().execute( "playCard", alice, { cardId: "KH", dealId: "deal-1" } );
			assert.deepStrictEqual( tags( events ), [ "callbreak/ev/CardPlayed" ] );
		} );

		it( "settles the trick and opens the next when the fourth card lands", () => {
			const game = playing( {
				tricks: [
					{
						leadPlayer: bob,
						suit: "H",
						cards: { [ bob ]: "4H", [ carol ]: "7H", [ dave ]: "9H" }
					}
				]
			}, alice );

			const events = game.execute( "playCard", alice, { cardId: "KH", dealId: "deal-1" } );
			assert.deepStrictEqual( tags( events ), [
				"callbreak/ev/CardPlayed",
				"callbreak/ev/TrickWon",
				"callbreak/ev/TrickStarted"
			] );

			assert.strictEqual( ( events[ 1 ] as { winner: PlayerId } ).winner, alice );
			assert.strictEqual( ( events[ 2 ] as { leadPlayer: PlayerId } ).leadPlayer, alice );
		} );

		it( "credits the winner and leaves the others alone", () => {
			const game = playing( {
				tricks: [
					{
						leadPlayer: bob,
						suit: "H",
						cards: { [ bob ]: "4H", [ carol ]: "7H", [ dave ]: "9H" }
					}
				]
			}, alice );

			game.play( "playCard", alice, { cardId: "KH", dealId: "deal-1" } );

			assert.strictEqual( game.state.deals[ 0 ]?.wins[ alice ], 1 );
			assert.strictEqual( game.state.deals[ 0 ]?.wins[ bob ], 0 );
		} );

		it( "does not open a fourteenth trick", () => {
			// The thirteenth ends the deal; starting another would leave an empty
			// trick on top of a deal nobody can play into.
			const tricks = Array.from( { length: CALLBREAK_TRICKS_PER_DEAL }, () => ( {
				leadPlayer: bob,
				suit: "H" as const,
				cards: { [ bob ]: "4H" as CardId, [ carol ]: "7H" as CardId, [ dave ]: "9H" as CardId },
				winner: bob
			} ) );

			tricks[ 0 ] = {
				leadPlayer: bob,
				suit: "H",
				cards: { [ bob ]: "4H", [ carol ]: "7H", [ dave ]: "9H" }
			} as never;

			const game = at( { deals: [ called( { tricks } ) ] }, "playing", alice );
			const events = game.execute( "playCard", alice, { cardId: "KH", dealId: "deal-1" } );

			assert.deepStrictEqual( tags( events ), [
				"callbreak/ev/CardPlayed",
				"callbreak/ev/TrickWon"
			] );
		} );
	} );

	describe( "the declaring phase", () => {

		it( "cuts a deal on the way in", () => {
			const game = at( { deals: [] } );
			const events = game.phase( "declaring" ).onEnter();

			assert.deepStrictEqual( tags( events ), [ "callbreak/ev/DealDealt" ] );

			game.apply( ...events );
			const cut = game.state.deals[ 0 ]!;

			assert.strictEqual( cut.id, "deal-1" );
			for ( const seat of SEATS ) {
				assert.strictEqual( cut.hands[ seat ]?.length, CALLBREAK_TRICKS_PER_DEAL );
				assert.strictEqual( cut.declarations[ seat ], 0, "zero is the sentinel, not absence" );
				assert.strictEqual( cut.wins[ seat ], 0 );
			}
		} );

		it( "deals every card exactly once", () => {
			const game = at( { deals: [] } );
			game.apply( ...game.phase( "declaring" ).onEnter() );

			const dealt = SEATS.flatMap( seat => game.state.deals[ 0 ]!.hands[ seat ]! );
			assert.strictEqual( dealt.length, 52 );
			assert.strictEqual( new Set( dealt ).size, 52 );
		} );

		it( "passes the deal round the table", () => {
			const first = at( { deals: [] } );
			first.apply( ...first.phase( "declaring" ).onEnter() );

			const second = at( { deals: [ deal( { scores: { [ alice ]: 30 } } ) ] } );
			second.apply( ...second.phase( "declaring" ).onEnter() );

			assert.strictEqual( first.state.deals[ 0 ]?.startingPlayer, alice );
			assert.strictEqual( second.state.deals[ 0 ]?.startingPlayer, bob );
			assert.strictEqual( second.state.deals[ 0 ]?.id, "deal-2" );
		} );

		it( "cuts a different deal each time", () => {
			// The shuffle is salted with the deal's index, so the third deal is
			// reproducibly different from the first.
			const first = at( { deals: [] } );
			first.apply( ...first.phase( "declaring" ).onEnter() );

			const second = at( { deals: [ deal() ] } );
			second.apply( ...second.phase( "declaring" ).onEnter() );

			assert.notDeepEqual(
				[ ...first.state.deals[ 0 ]!.hands[ alice ]! ],
				[ ...second.state.deals[ 0 ]!.hands[ alice ]! ]
			);
		} );

		it( "seats the deal's own opener", () => {
			const game = at( { deals: [ deal( { startingPlayer: carol } ) ] } );
			assert.strictEqual( game.phase( "declaring" ).startingPlayer(), carol );
		} );

		it( "runs until the last call is in", () => {
			const game = at();
			assert.isFalse( game.phase( "declaring" ).endIf() );

			for ( const seat of SEATS.slice( 0, 3 ) ) {
				game.play( "declareWins", seat, { wins: 3, dealId: "deal-1" } );
				assert.isFalse( game.phase( "declaring" ).endIf() );
			}

			game.play( "declareWins", dave, { wins: 3, dealId: "deal-1" } );
			assert.isTrue( game.phase( "declaring" ).endIf() );
		} );

		it( "goes round the table as the calls come in", () => {
			assert.strictEqual( at().phase( "declaring" ).nextPlayer( alice, "declareWins" ), bob );
			assert.strictEqual( at().phase( "declaring" ).nextPlayer( dave, "declareWins" ), alice );
		} );

		it( "always hands over to playing", () => {
			assert.strictEqual( at().phase( "declaring" ).nextPhase(), "playing" );
		} );
	} );

	describe( "the playing phase", () => {

		const playing = ( overrides: Partial<Deal> = {} ) =>
			at( { deals: [ called( overrides ) ] }, "playing" );

		it( "opens the first trick for the deal's opener", () => {
			const game = at( { deals: [ called( { startingPlayer: carol } ) ] }, "playing" );
			const events = game.phase( "playing" ).onEnter();

			assert.deepStrictEqual( tags( events ), [ "callbreak/ev/TrickStarted" ] );
			assert.strictEqual( ( events[ 0 ] as { leadPlayer: PlayerId } ).leadPlayer, carol );
		} );

		it( "seats whoever leads the trick in play", () => {
			const game = playing( { tricks: [ { leadPlayer: dave, cards: {} } ] } );
			assert.strictEqual( game.phase( "playing" ).startingPlayer(), dave );
		} );

		it( "reads the next seat off how far the trick has got", () => {
			const game = playing( {
				tricks: [ { leadPlayer: carol, suit: "H", cards: { [ carol ]: "7H" } } ]
			} );

			// Play order is the seating order rotated to the leader.
			assert.strictEqual( game.phase( "playing" ).nextPlayer( carol, "playCard" ), dave );
		} );

		it( "names the leader for a fresh trick", () => {
			const game = playing( { tricks: [ { leadPlayer: dave, cards: {} } ] } );
			assert.strictEqual( game.phase( "playing" ).nextPlayer( carol, "playCard" ), dave );
		} );

		it( "runs until the thirteenth trick is taken", () => {
			const twelve = Array.from( { length: 12 }, () => ( {
				leadPlayer: alice,
				cards: {},
				winner: alice
			} ) );

			assert.isFalse( playing( { tricks: twelve } ).phase( "playing" ).endIf() );

			const thirteenOpen = [ { leadPlayer: alice, cards: {} }, ...twelve ];
			assert.isFalse( playing( { tricks: thirteenOpen } ).phase( "playing" ).endIf() );

			const thirteenTaken = [ { leadPlayer: alice, cards: {}, winner: alice }, ...twelve ];
			assert.isTrue( playing( { tricks: thirteenTaken } ).phase( "playing" ).endIf() );
		} );

		it( "scores the deal on the way out", () => {
			const game = playing( {
				declarations: {
					[ alice ]: 3, [ bob ]: 4, [ carol ]: 2, [ dave ]: 4
				} as Record<PlayerId, number>,
				wins: {
					[ alice ]: 5, [ bob ]: 4, [ carol ]: 1, [ dave ]: 3
				} as Record<PlayerId, number>
			} );

			const events = game.phase( "playing" ).onExit();
			assert.deepStrictEqual( tags( events ), [ "callbreak/ev/DealScored" ] );

			game.apply( ...events );
			assert.deepStrictEqual( { ...game.state.deals[ 0 ]?.scores }, {
				alice: 32,
				bob: 40,
				carol: -20,
				dave: -40
			} );
		} );

		it( "adds the deal's score onto the running total", () => {
			const game = at(
				{ deals: [ called() ], scores: { [ alice ]: 30 } as Record<PlayerId, number> },
				"playing"
			);

			game.apply( {
				_tag: "callbreak/ev/DealScored",
				scores: { [ alice ]: 32 } as Record<PlayerId, number>
			} );

			assert.strictEqual( game.state.scores[ alice ], 62 );
		} );

		it( "always points back at declaring — `endIf` is what stops the loop", () => {
			assert.strictEqual( playing().phase( "playing" ).nextPhase(), "declaring" );
		} );
	} );

	describe( "endIf", () => {

		const scored = ( id: string ) => deal( {
			id,
			scores: { [ alice ]: 30 } as Record<PlayerId, number>
		} );

		it( "keeps going while deals are left to play", () => {
			const game = at( { deals: [ scored( "deal-1" ) ] }, "playing", alice, { dealCount: 5 } );
			assert.isFalse( game.endIf() );
		} );

		it( "keeps going while the last deal is unscored", () => {
			const deals = [
				deal( { id: "deal-5" } ),
				...[ 1, 2, 3, 4 ].map( n => scored( `deal-${ n }` ) )
			];
			const game = at( { deals }, "playing", alice, { dealCount: 5 } );
			assert.isFalse( game.endIf() );
		} );

		it( "ends once every deal the table asked for is played and scored", () => {
			const deals = [ 5, 4, 3, 2, 1 ].map( n => scored( `deal-${ n }` ) );
			const game = at( { deals }, "playing", alice, { dealCount: 5 } );
			assert.isTrue( game.endIf() );
		} );

		it( "respects a longer table", () => {
			const deals = [ 5, 4, 3, 2, 1 ].map( n => scored( `deal-${ n }` ) );
			const game = at( { deals }, "playing", alice, { dealCount: 9 } );
			assert.isFalse( game.endIf() );
		} );
	} );

	describe( "resolveResults", () => {

		it( "ranks on the running total, highest first", () => {
			const game = at( {
				scores: {
					[ alice ]: 50,
					[ bob ]: 120,
					[ carol ]: -30,
					[ dave ]: 40
				} as Record<PlayerId, number>
			} );

			const results = game.results();
			assert.deepStrictEqual(
				results?.ranking.map( entry => [ entry.playerId, entry.rank ] ),
				[ [ bob, 1 ], [ alice, 2 ], [ dave, 3 ], [ carol, 4 ] ]
			);
		} );

		it( "lets seats level on points share a place", () => {
			const game = at( {
				scores: {
					[ alice ]: 50,
					[ bob ]: 50,
					[ carol ]: 10,
					[ dave ]: 10
				} as Record<PlayerId, number>
			} );

			assert.deepStrictEqual( game.results()?.ranking.map( entry => entry.rank ), [ 1, 1, 3, 3 ] );
		} );

		it( "carries the score on each standing", () => {
			const game = at( { scores: { alice: 50 } as Record<PlayerId, number> } );
			const standing = game.results()?.ranking.find( entry => entry.playerId === alice );
			assert.strictEqual( standing?.score, 50 );
		} );
	} );

	describe( "the view", () => {

		it( "gives a seat its own cards and everyone's counts", () => {
			const game = at();
			const view = game.view( PlayerAudience.make( { playerId: bob } ) );

			assert.deepStrictEqual( [ ...view.hand ], [ ...deal().hands[ bob ]! ] );
			assert.deepStrictEqual( { ...view.handCounts }, { alice: 6, bob: 6, carol: 6, dave: 6 } );
		} );

		it( "gives the table the counts and no cards", () => {
			const view = at().view( TableAudience.make( {} ) );

			assert.deepStrictEqual( [ ...view.hand ], [] );
			assert.isUndefined( view.playerId );
			assert.deepStrictEqual( { ...view.handCounts }, { alice: 6, bob: 6, carol: 6, dave: 6 } );
		} );

		it( "publishes the active deal without its hands", () => {
			const view = at().view( TableAudience.make( {} ) );

			assert.strictEqual( view.activeDeal?.id, "deal-1" );
			assert.notProperty( view.activeDeal, "hands" );
		} );

		it( "publishes the declarations — a call is made out loud", () => {
			const game = at();
			game.play( "declareWins", bob, { wins: 5, dealId: "deal-1" } );

			const view = game.view( TableAudience.make( {} ) );
			assert.strictEqual( view.activeDeal?.declarations[ bob ], 5 );
		} );

		it( "counts the deals actually finished, not the ones cut", () => {
			// The one projected deal cannot say how far through the table is — and a
			// deal in progress has not been played yet.
			const done = ( id: string ) =>
				deal( { id, scores: { [ alice ]: 30 } as Record<PlayerId, number> } );

			const game = at( {
				deals: [
					deal( { id: "deal-3" } ),
					done( "deal-2" ),
					done( "deal-1" )
				]
			} );
			assert.strictEqual( game.view( TableAudience.make( {} ) ).dealsPlayed, 2 );
		} );

		it( "publishes the running total to everybody", () => {
			const game = at( { scores: { alice: 50 } as Record<PlayerId, number> } );
			assert.strictEqual( game.view( TableAudience.make( {} ) ).scores[ alice ], 50 );
		} );
	} );

	describe( "botMove", () => {

		it( "calls a declaration inside the legal range", () => {
			const game = at();
			const choice = game.bot( PlayerAudience.make( { playerId: alice } ) );

			assert.strictEqual( choice?.moveType, "declareWins" );

			const input = choice?.input as { wins: number; dealId: string };
			assert.isAtLeast( input.wins, 1 );
			assert.isAtMost( input.wins, CALLBREAK_TRICKS_PER_DEAL );
			assert.strictEqual( input.dealId, "deal-1" );
		} );

		it( "plays only a card the rules would accept", () => {
			// The policy picks from `getPlayableCards`, the same function that
			// validates — so a bot cannot be offered a card a player would be refused.
			const game = at(
				{
					deals: [
						called( {
							tricks: [ { leadPlayer: bob, suit: "H", cards: { [ bob ]: "4H" } } ]
						} )
					]
				},
				"playing",
				alice
			);

			const choice = game.bot( PlayerAudience.make( { playerId: alice } ) );
			assert.strictEqual( choice?.moveType, "playCard" );

			const input = choice?.input as { cardId: CardId; dealId: string };
			assert.isUndefined( game.validate( "playCard", alice, input ) );
		} );

		it( "has nothing to say with no deal in play", () => {
			const game = at( { deals: [] } );
			assert.isUndefined( game.bot( PlayerAudience.make( { playerId: alice } ) ) );
		} );
	} );
} );
