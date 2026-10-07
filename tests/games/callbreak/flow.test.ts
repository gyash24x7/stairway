import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import type { Table } from "@tests/harness/table";
import { makeTable, PARKED, rejectionTag } from "@tests/harness/table";
import { makeUsers } from "@tests/harness/users";

import { CALLBREAK_TRICKS_PER_DEAL } from "@/games/callbreak/schema";
import {
	CallbreakEngine,
	CallbreakEngineLive,
	CallbreakStructure
} from "@/games/callbreak/server/engine";
import { displayedTrick, getPlayableCards } from "@/games/callbreak/utils";


const Callbreak = {
	Engine: CallbreakEngine,
	EngineLive: CallbreakEngineLive,
	Structure: CallbreakStructure
};

const TABLE = Object.values( makeUsers( [ "alice", "bob", "carol", "dave" ] as const ) );

type CallbreakTable = Table<typeof CallbreakStructure>;

const seated = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* makeTable( Callbreak, {
		players: TABLE,
		name,
		config: { playerCount: 4, dealCount: 5, trumpSuit: "S", ...PARKED, ...config }
	} );

	yield* game.joinAll();
	return game;
} );

/** Everyone calls three, in the order the deal asks for them. */
const declareAll = ( game: CallbreakTable ) => Effect.gen( function* () {
	for ( let i = 0; i < TABLE.length; i++ ) {
		const view = yield* game.view();
		const seat = view.context.currentPlayer!;
		yield* game.move( seat, "declareWins", { wins: 3, dealId: view.view.activeDeal!.id } );
	}
} );

/** Plays one legal card for whoever the cursor is on. */
const playOne = ( game: CallbreakTable ) => Effect.gen( function* () {
	const view = yield* game.view();
	const seat = view.context.currentPlayer!;
	const deal = view.view.activeDeal!;
	const hand = ( yield* game.state( seat ) ).hand;

	const playable = getPlayableCards( hand, view.config.trumpSuit, deal.tricks[ 0 ]! );
	yield* game.move( seat, "playCard", { cardId: playable[ 0 ]!, dealId: deal.id } );

	return seat;
} );

describe( "callbreak flow", () => {

	describe( "the table", () => {

		it.live( "seats four and enters the declaring phase", () => Effect.gen( function* () {
			const game = yield* seated( "table-start" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual( view.context.phase, "declaring" );
			assert.strictEqual( view.context.players.length, 4 );
		} ) );

		it.live( "cuts a deal on entering, thirteen cards each", () => Effect.gen( function* () {
			const game = yield* seated( "table-deal" );
			const view = yield* game.view();

			assert.strictEqual( view.view.activeDeal?.id, "deal-1" );
			assert.deepStrictEqual(
				Object.values( view.view.handCounts ),
				[ 13, 13, 13, 13 ]
			);
			assert.strictEqual( ( yield* game.state( "alice" ) ).hand.length, 13 );
		} ) );

		it.live( "seats the deal's own opener", () => Effect.gen( function* () {
			const game = yield* seated( "table-opener" );
			const view = yield* game.view();

			assert.strictEqual( view.context.currentPlayer, view.view.activeDeal?.startingPlayer );
		} ) );

		it.live( "keeps every hand to its own seat", () => Effect.gen( function* () {
			const game = yield* seated( "table-redaction" );

			assert.strictEqual( ( yield* game.state() ).hand.length, 0 );
			assert.strictEqual( ( yield* game.state( "bob" ) ).hand.length, 13 );

			// The active deal crosses the wire without its hands at all.
			assert.notProperty( ( yield* game.state() ).activeDeal, "hands" );
		} ) );

		it.live( "seeds every running total at zero", () => Effect.gen( function* () {
			const game = yield* seated( "table-scores" );
			const view = yield* game.view();

			assert.deepStrictEqual( Object.values( view.view.scores ), [ 0, 0, 0, 0 ] );
			assert.strictEqual( view.view.dealsPlayed, 0 );
		} ) );
	} );

	describe( "declaring", () => {

		it.live( "refuses playing a card in the declaring phase", () => Effect.gen( function* () {
			const game = yield* seated( "declare-phase-gate" );
			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const hand = ( yield* game.state( seat ) ).hand;

			const tag = yield* rejectionTag( game.move( seat, "playCard", {
				cardId: hand[ 0 ]!,
				dealId: view.view.activeDeal!.id
			} ) );

			assert.strictEqual( tag, "swish/MoveNotAllowed" );
		} ) );

		it.live( "refuses a call out of turn", () => Effect.gen( function* () {
			const game = yield* seated( "declare-order" );
			const view = yield* game.view();
			const waiting = view.context.players.find(
				seat => seat !== view.context.currentPlayer
			)!;

			const tag = yield* rejectionTag( game.move( waiting, "declareWins", {
				wins: 3,
				dealId: view.view.activeDeal!.id
			} ) );

			assert.strictEqual( tag, "swish/NotYourTurn" );
		} ) );

		it.live( "goes round the table as calls come in", () => Effect.gen( function* () {
			const game = yield* seated( "declare-round" );
			const opener = ( yield* game.view() ).context.currentPlayer!;

			yield* game.move( opener, "declareWins", { wins: 3, dealId: "deal-1" } );

			const view = yield* game.view();
			const order = view.context.players;
			const next = order[ ( order.indexOf( opener ) + 1 ) % order.length ];

			assert.strictEqual( view.context.currentPlayer, next );
			assert.strictEqual( view.view.activeDeal?.declarations[ opener ], 3 );
		} ) );

		it.live( "refuses a second call from the same seat", () => Effect.gen( function* () {
			const game = yield* seated( "declare-twice" );
			const opener = ( yield* game.view() ).context.currentPlayer!;

			yield* game.move( opener, "declareWins", { wins: 3, dealId: "deal-1" } );

			// The cursor has moved on, so the seat is refused for that first.
			const tag = yield* rejectionTag(
				game.move( opener, "declareWins", { wins: 4, dealId: "deal-1" } )
			);

			assert.strictEqual( tag, "swish/NotYourTurn" );
		} ) );

		it.live( "refuses a call naming the wrong deal", () => Effect.gen( function* () {
			const game = yield* seated( "declare-stale" );
			const opener = ( yield* game.view() ).context.currentPlayer!;

			const tag = yield* rejectionTag(
				game.move( opener, "declareWins", { wins: 3, dealId: "deal-9" } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "turns over to playing once the last call is in", () => Effect.gen( function* () {
			const game = yield* seated( "declare-turnover" );
			yield* declareAll( game );

			const view = yield* game.view();
			assert.strictEqual( view.context.phase, "playing" );

			// The first trick is opened for the deal's opener.
			assert.strictEqual( view.view.activeDeal?.tricks.length, 1 );
			assert.strictEqual(
				view.view.activeDeal?.tricks[ 0 ]?.leadPlayer,
				view.view.activeDeal?.startingPlayer
			);
			assert.strictEqual( view.context.currentPlayer, view.view.activeDeal?.startingPlayer );
		} ) );
	} );

	describe( "playing", () => {

		const playingTable = ( name: string ) => Effect.gen( function* () {
			const game = yield* seated( name );
			yield* declareAll( game );
			return game;
		} );

		it.live( "refuses declaring once the playing phase is on", () => Effect.gen( function* () {
			const game = yield* playingTable( "play-phase-gate" );
			const seat = ( yield* game.view() ).context.currentPlayer!;

			const tag = yield* rejectionTag(
				game.move( seat, "declareWins", { wins: 3, dealId: "deal-1" } )
			);

			assert.strictEqual( tag, "swish/MoveNotAllowed" );
		} ) );

		it.live( "takes a card off the hand and sets the led suit", () => Effect.gen( function* () {
			const game = yield* playingTable( "play-lead" );
			const seat = ( yield* game.view() ).context.currentPlayer!;
			const before = ( yield* game.state( seat ) ).hand;

			yield* game.move( seat, "playCard", { cardId: before[ 0 ]!, dealId: "deal-1" } );

			const view = yield* game.view();
			const trick = view.view.activeDeal!.tricks[ 0 ]!;

			assert.strictEqual( trick.cards[ seat ], before[ 0 ] );
			assert.isDefined( trick.suit );
			assert.strictEqual( ( yield* game.state( seat ) ).hand.length, 12 );
			assert.strictEqual( view.view.handCounts[ seat ], 12 );
		} ) );

		it.live( "refuses a card the seat does not hold", () => Effect.gen( function* () {
			const game = yield* playingTable( "play-not-held" );
			const view = yield* game.view();
			const seat = view.context.currentPlayer!;
			const mine = ( yield* game.state( seat ) ).hand;

			const other = view.context.players.find( player => player !== seat )!;
			const theirs = ( yield* game.state( other ) ).hand.find(
				card => !mine.includes( card )
			)!;

			const tag = yield* rejectionTag(
				game.move( seat, "playCard", { cardId: theirs, dealId: "deal-1" } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "enforces following suit and heading the trick", () => Effect.gen( function* () {
			const game = yield* playingTable( "play-strict" );

			const seat = ( yield* game.view() ).context.currentPlayer!;
			const hand = ( yield* game.state( seat ) ).hand;
			yield* game.move( seat, "playCard", { cardId: hand[ 0 ]!, dealId: "deal-1" } );

			const view = yield* game.view();
			const next = view.context.currentPlayer!;
			const trick = view.view.activeDeal!.tricks[ 0 ]!;
			const theirHand = ( yield* game.state( next ) ).hand;

			const playable = getPlayableCards( theirHand, view.config.trumpSuit, trick );
			const refused = theirHand.filter( card => !playable.includes( card ) );

			if ( refused.length === 0 ) {
				// Nothing to enforce from this hand; the legal set is everything.
				assert.strictEqual( playable.length, theirHand.length );
				return;
			}

			const tag = yield* rejectionTag(
				game.move( next, "playCard", { cardId: refused[ 0 ]!, dealId: "deal-1" } )
			);

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live(
			"settles a trick on the fourth card and opens the next",
			() => Effect.gen( function* () {
				const game = yield* playingTable( "play-trick" );

				for ( let i = 0; i < 4; i++ ) {
					yield* playOne( game );
				}

				const view = yield* game.view();
				const deal = view.view.activeDeal!;

				assert.strictEqual( deal.tricks.length, 2, "a fresh trick is open" );
				assert.isDefined( deal.tricks[ 1 ]?.winner, "and the last one is settled" );

				const winner = deal.tricks[ 1 ]!.winner!;
				assert.strictEqual( deal.wins[ winner ], 1 );
				assert.strictEqual( deal.tricks[ 0 ]?.leadPlayer, winner, "the winner leads" );
				assert.strictEqual( view.context.currentPlayer, winner );
				assert.strictEqual( view.view.lastCompletedTrick?.winner, winner );
			} )
		);

		it.live(
			"keeps a finished trick on show until the next is led",
			() => Effect.gen( function* () {
				const game = yield* playingTable( "play-trick-shown" );

				for ( let i = 0; i < 4; i++ ) {
					yield* playOne( game );
				}

				// The fourth card and the next trick land in the one commit, so the
				// trick in play is already empty — what the table draws is the full one.
				const settled = ( yield* game.view() ).view;
				assert.deepStrictEqual( settled.activeDeal!.tricks[ 0 ]!.cards, {} );
				assert.strictEqual( Object.keys( displayedTrick( settled )!.cards ).length, 4 );
				assert.isDefined( displayedTrick( settled )!.winner );

				const leader = yield* playOne( game );
				const led = displayedTrick( ( yield* game.view() ).view )!;
				assert.deepStrictEqual(
					Object.keys( led.cards ),
					[ leader ],
					"then the new trick takes over"
				);
			} )
		);

		it.live( "plays a whole deal out and scores it", () => Effect.gen( function* () {
			const game = yield* playingTable( "play-deal" );

			for ( let i = 0; i < CALLBREAK_TRICKS_PER_DEAL * 4; i++ ) {
				yield* playOne( game );
			}

			const view = yield* game.view();

			// The deal is scored on the way out of the playing phase, and the next
			// deal is cut on the way back into declaring.
			assert.strictEqual( view.context.phase, "declaring" );
			assert.strictEqual( view.view.dealsPlayed, 1 );
			assert.strictEqual( view.view.activeDeal?.id, "deal-2" );
			assert.deepStrictEqual(
				Object.values( view.view.handCounts ),
				[ 13, 13, 13, 13 ],
				"and a fresh deal is dealt"
			);

			// Thirteen tricks were taken, and the running totals moved.
			const total = Object.values( view.view.scores ).filter( score => score !== 0 );
			assert.isAbove( total.length, 0 );

			// The thirteenth trick went out in the same commit as the new deal, so it
			// is reached back for — and stays on show until somebody calls.
			const last = view.view.lastCompletedTrick;
			assert.strictEqual( Object.keys( last?.cards ?? {} ).length, 4 );
			assert.strictEqual( displayedTrick( view.view ), last );

			const seat = view.context.currentPlayer!;
			yield* game.move( seat, "declareWins", { wins: 3, dealId: "deal-2" } );
			assert.isUndefined( displayedTrick( ( yield* game.view() ).view ) );
		} ), 30_000 );

		it.live( "passes the deal on to the next seat", () => Effect.gen( function* () {
			const game = yield* playingTable( "play-rotate" );
			const first = ( yield* game.view() ).view.activeDeal!.startingPlayer;

			for ( let i = 0; i < CALLBREAK_TRICKS_PER_DEAL * 4; i++ ) {
				yield* playOne( game );
			}

			const view = yield* game.view();
			const order = view.context.players;
			const expected = order[ ( order.indexOf( first ) + 1 ) % order.length ];

			assert.strictEqual( view.view.activeDeal?.startingPlayer, expected );
		} ), 30_000 );
	} );

	describe( "bots", () => {

		it.live( "plays a whole table of five deals out", () => Effect.gen( function* () {
			const game = yield* makeTable( Callbreak, {
				players: TABLE,
				name: "bot-table",
				config: { playerCount: 4, dealCount: 5, trumpSuit: "S", botDelayMillis: 1 }
			} );

			yield* game.addBots();

			// Callbreak arms no move clock — the policy has nothing to say with no
			// deal or trick in play, so a timeout would have nowhere to hand the turn.
			// A human seat therefore has to give itself up, which is what `autoPlay`
			// is for; without it the table waits on alice forever.
			yield* game.autoPlay( "alice", true );

			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 150 )
			);

			assert.strictEqual( view.view.dealsPlayed, 5 );
			assert.strictEqual( view.results?.ranking.length, 4 );

			// Every deal's thirteen tricks were taken by somebody, five times over.
			const totals = Object.values( view.view.scores );
			assert.strictEqual( totals.length, 4 );
		} ), 180_000 );
	} );
} );
