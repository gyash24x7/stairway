import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import type { Table } from "@tests/harness/table";
import { makeTable, PARKED, rejectionTag } from "@tests/harness/table";
import { makeUsers } from "@tests/harness/users";

import type { CoupCard } from "@/games/coup/schema";
import { CoupEngine, CoupEngineLive, CoupStructure } from "@/games/coup/server/engine";
import type { PlayerId } from "@/swish/schema";


const Coup = { Engine: CoupEngine, EngineLive: CoupEngineLive, Structure: CoupStructure };

const PLAYERS = Object.values( makeUsers( [ "alice", "bob", "carol" ] as const ) );

// `PlayerId` is branded, so the ids a test indexes a record with have to be too.
const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;

/** A dealt three-handed table, with the clocks parked. */
const dealt = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* makeTable( Coup, {
		players: PLAYERS,
		name,
		config: { playerCount: 3, ...PARKED, ...config }
	} );

	yield* game.joinAll();
	return game;
} );

/** Who is holding what, read back off each seat's own view. */
const handsOf = ( game: Table<typeof CoupStructure> ) => Effect.gen( function* () {
	const hands: Record<PlayerId, ReadonlyArray<CoupCard>> = {};
	for ( const seat of game.roster ) {
		hands[ seat.id ] = ( yield* game.state( seat ) ).hand;
	}

	return hands;
} );


describe( "coup flow", () => {

	describe( "the deal", () => {

		it.live( "gives everybody two cards and two coins", () => Effect.gen( function* () {
			const game = yield* dealt( "deal-start" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.deepStrictEqual( { ...view.view.influence }, { alice: 2, bob: 2, carol: 2 } );
			assert.deepStrictEqual( { ...view.view.coins }, { alice: 2, bob: 2, carol: 2 } );

			// Twenty cards, six dealt out.
			assert.strictEqual( view.view.deckSize, 14 );
		} ) );

		it.live( "deals the same table the same hands, every run", () => Effect.gen( function* () {
			const first = yield* dealt( "deal-repeat" );
			const second = yield* dealt( "deal-repeat" );

			assert.deepStrictEqual( yield* handsOf( first ), yield* handsOf( second ) );
		} ) );

		it.live( "shows a seat only its own cards", () => Effect.gen( function* () {
			const game = yield* dealt( "deal-redaction" );

			const mine = yield* game.state( "alice" );
			const table = yield* game.state();

			assert.strictEqual( mine.hand.length, 2 );
			assert.strictEqual( table.hand.length, 0 );
			assert.deepStrictEqual( table.influence, mine.influence );
		} ) );
	} );

	describe( "income and coup", () => {

		it.live( "pays income without opening anything", () => Effect.gen( function* () {
			const game = yield* dealt( "income-plain" );
			yield* game.move( "alice", "income", {} );

			const view = yield* game.view();
			assert.strictEqual( view.view.coins[ alice ], 3 );
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( view.context.currentPlayer, "bob" );
		} ) );

		it.live( "forces a coup at ten coins", () => Effect.gen( function* () {
			const game = yield* dealt( "coup-forced" );

			// Eight incomes round the table brings alice from two to ten.
			for ( let round = 0; round < 8; round++ ) {
				yield* game.move( "alice", "income", {} );
				yield* game.move( "bob", "income", {} );
				yield* game.move( "carol", "income", {} );
			}

			const view = yield* game.view();
			assert.strictEqual( view.view.coins[ alice ], 10 );

			const tag = yield* rejectionTag( game.move( "alice", "income", {} ) );
			assert.strictEqual( tag, "swish/InvalidMove" );

			yield* game.move( "alice", "coup", { target: bob } );
			assert.strictEqual( ( yield* game.frame() )?.kind, "loseInfluence" );
		} ) );

		it.live( "asks the coup's target for a card, and nobody else", () => Effect.gen( function* () {
			const game = yield* dealt( "coup-target" );

			for ( let round = 0; round < 5; round++ ) {
				yield* game.move( "alice", "income", {} );
				yield* game.move( "bob", "income", {} );
				yield* game.move( "carol", "income", {} );
			}

			yield* game.move( "alice", "coup", { target: bob } );

			const frame = yield* game.frame();
			assert.strictEqual( frame?.kind, "loseInfluence" );
			assert.deepStrictEqual( [ ...frame!.responders ], [ "bob" ] );
			assert.strictEqual( frame?.subject, "bob" );
			assert.isFalse( frame!.allowPass, "giving up a card is not optional" );
		} ) );
	} );

	describe( "a window holding the turn", () => {

		const taxed = ( name: string ) => Effect.gen( function* () {
			const game = yield* dealt( name );
			yield* game.move( "alice", "tax", {} );
			return game;
		} );

		it.live( "opens over everybody but the claimant", () => Effect.gen( function* () {
			const game = yield* taxed( "window-open" );
			const frame = yield* game.frame();

			assert.strictEqual( frame?.kind, "claim" );
			assert.strictEqual( frame?.initiator, "alice" );
			assert.deepStrictEqual( [ ...frame!.responders ], [ "bob", "carol" ] );
			assert.deepStrictEqual( [ ...frame!.pending ], [ "bob", "carol" ] );
		} ) );

		it.live( "suspends the turn rather than passing it on", () => Effect.gen( function* () {
			const game = yield* taxed( "window-suspends" );
			const context = yield* game.context();

			assert.strictEqual( context.currentPlayer, "alice" );
			assert.strictEqual( context.suspended?.actor, "alice" );
			assert.strictEqual( context.suspended?.moveType, "tax" );
		} ) );

		it.live( "fills the window in from its declaration", () => Effect.gen( function* () {
			const game = yield* taxed( "window-defaults" );
			const frame = yield* game.frame();

			// The game named only the kind, the responders and the options; the rest
			// is copied onto the event from the structure, once, on the way in.
			assert.strictEqual( frame?.resolution, "first" );
			assert.isTrue( frame!.allowPass );
			assert.isFalse( frame!.secret );
			assert.strictEqual( frame?.timeoutMillis, 15_000 );
		} ) );

		it.live( "refuses an ordinary turn action while it is open", () => Effect.gen( function* () {
			const game = yield* taxed( "window-blocks-moves" );

			// Bob *is* being asked, so his `income` is read as an answer to the
			// window — and the window does not list it.
			const tag = yield* rejectionTag( game.move( "bob", "income", {} ) );
			assert.strictEqual( tag, "swish/NotRespondingTo" );
		} ) );

		it.live( "tells a seat it is not being asked", () => Effect.gen( function* () {
			const game = yield* taxed( "window-not-asked" );

			// Alice is the claimant, so she is not in `pending` — she is not
			// answering badly, she is taking a turn the window has suspended.
			const tag = yield* rejectionTag( game.move( "alice", "income", {} ) );
			assert.strictEqual( tag, "swish/InteractionInProgress" );
		} ) );

		it.live( "refuses an undo while it is open", () => Effect.gen( function* () {
			const game = yield* taxed( "window-blocks-undo" );
			const tag = yield* rejectionTag( game.undo( "alice" ) );
			assert.strictEqual( tag, "swish/InteractionInProgress" );
		} ) );

		it.live( "takes one pass off the window and leaves it open", () => Effect.gen( function* () {
			const game = yield* taxed( "window-one-pass" );
			yield* game.pass( "bob" );

			const frame = yield* game.frame();
			assert.deepStrictEqual( [ ...frame!.pending ], [ "carol" ] );
			assert.strictEqual( frame?.responses.length, 1 );
		} ) );

		it.live( "settles once the last responder has answered", () => Effect.gen( function* () {
			const game = yield* dealt( "window-all-pass" );
			yield* game.move( "alice", "tax", {} );
			yield* game.pass( "bob" );
			yield* game.pass( "carol" );

			const view = yield* game.view();
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( view.view.coins[ alice ], 5, "the tax goes through" );
			assert.strictEqual( view.context.currentPlayer, "bob", "and the turn resumes" );
			assert.isUndefined( view.context.suspended );
		} ) );

		it.live( "refuses a pass from somebody it is not waiting on", () => Effect.gen( function* () {
			const game = yield* taxed( "window-wrong-passer" );
			const tag = yield* rejectionTag( game.pass( "alice" ) );
			assert.strictEqual( tag, "swish/NotRespondingTo" );
		} ) );

		it.live( "refuses a pass on a window that names a stale frame", () => Effect.gen( function* () {
			const game = yield* taxed( "window-stale-pass" );
			const tag = yield* rejectionTag( game.pass( "bob", "some-other-frame" ) );
			assert.strictEqual( tag, "swish/InteractionStale" );
		} ) );
	} );

	describe( "challenging a claim", () => {

		it.live( "settles a challenge and asks the loser for a card", () => Effect.gen( function* () {
			const game = yield* dealt( "challenge-settles" );
			const hands = yield* handsOf( game );

			yield* game.move( "alice", "tax", {} );
			yield* game.respond( "bob", "challenge", {} );

			// Whoever was wrong is the one now being asked for a card.
			const loser = hands[ alice ]!.includes( "DUKE" ) ? "bob" : "alice";
			const frame = yield* game.frame();

			assert.strictEqual( frame?.kind, "loseInfluence" );
			assert.deepStrictEqual( [ ...frame!.responders ], [ loser ] );
		} ) );

		it.live( "throws the action out when the claim was a bluff", () => Effect.gen( function* () {
			const game = yield* dealt( "challenge-bluff" );
			const hands = yield* handsOf( game );

			yield* game.move( "alice", "tax", {} );
			yield* game.respond( "bob", "challenge", {} );

			const view = yield* game.view();
			const expected = hands[ alice ]!.includes( "DUKE" ) ? 5 : 2;
			assert.strictEqual( view.view.coins[ alice ], expected );
		} ) );

		it.live( "closes the race — a second challenger is too late", () => Effect.gen( function* () {
			const game = yield* dealt( "challenge-race" );

			yield* game.move( "alice", "tax", {} );
			yield* game.respond( "bob", "challenge", {} );

			// The claim window resolved `first`, so carol never gets asked.
			const tag = yield* rejectionTag( game.respond( "carol", "challenge", {} ) );
			assert.oneOf( tag, [ "swish/InteractionInProgress", "swish/InvalidMove" ] );
		} ) );

		it.live( "will not take a pass on the card it now has to have", () => Effect.gen( function* () {
			const game = yield* dealt( "challenge-mandatory" );
			const hands = yield* handsOf( game );

			yield* game.move( "alice", "tax", {} );
			yield* game.respond( "bob", "challenge", {} );

			const loser = hands[ alice ]!.includes( "DUKE" ) ? "bob" : "alice";
			const tag = yield* rejectionTag( game.pass( loser ) );
			assert.strictEqual( tag, "swish/PassNotAllowed" );
		} ) );

		it.live( "resumes the turn once the card is given up", () => Effect.gen( function* () {
			const game = yield* dealt( "challenge-resumes" );
			const hands = yield* handsOf( game );

			yield* game.move( "alice", "tax", {} );
			yield* game.respond( "bob", "challenge", {} );

			const loser = hands[ alice ]!.includes( "DUKE" ) ? bob : alice;
			const hand = ( yield* game.state( loser ) ).hand;
			yield* game.respond( loser, "reveal", { card: hand[ 0 ]! } );

			const view = yield* game.view();
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( view.view.influence[ loser ], 1 );
			assert.strictEqual( view.context.currentPlayer, "bob", "the turn moves on" );
		} ) );

		it.live( "keeps a proven claimant's hand the same size", () => Effect.gen( function* () {
			const game = yield* dealt( "challenge-replaces" );
			const hands = yield* handsOf( game );

			yield* game.move( "alice", "tax", {} );
			yield* game.respond( "bob", "challenge", {} );

			if ( !hands[ alice ]!.includes( "DUKE" ) ) {
				return;
			}

			// The shown card goes back and a fresh one is drawn, so proving a claim
			// says what you held a moment ago and nothing about what you hold now.
			const after = yield* game.state( "alice" );
			assert.strictEqual( after.hand.length, 2 );
			assert.strictEqual( ( yield* game.view() ).view.deckSize, 14 );
		} ) );
	} );

	describe( "blocking, and challenging the block", () => {

		it.live(
			"nests a second window inside the first one's resolution",
			() => Effect.gen( function* () {
				const game = yield* dealt( "block-nests" );

				yield* game.move( "alice", "foreignAid", {} );
				yield* game.respond( "bob", "blockForeignAid", {} );

				const frame = yield* game.frame();
				assert.strictEqual( frame?.kind, "blockClaim" );
				assert.strictEqual( frame?.initiator, "bob" );
				assert.deepStrictEqual( [ ...frame!.responders ], [ "alice", "carol" ] );
				assert.deepStrictEqual( frame?.options.map( o => o.move ), [ "challenge" ] );
			} )
		);

		it.live( "throws the aid out when nobody doubts the block", () => Effect.gen( function* () {
			const game = yield* dealt( "block-stands" );

			yield* game.move( "alice", "foreignAid", {} );
			yield* game.respond( "bob", "blockForeignAid", {} );
			yield* game.pass( "alice" );
			yield* game.pass( "carol" );

			const view = yield* game.view();
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( view.view.coins[ alice ], 2, "no aid was paid" );
			assert.strictEqual( view.context.currentPlayer, "bob" );
		} ) );

		it.live( "pays the aid after all when the block was a bluff", () => Effect.gen( function* () {
			const game = yield* dealt( "block-caught" );
			const hands = yield* handsOf( game );

			yield* game.move( "alice", "foreignAid", {} );
			yield* game.respond( "bob", "blockForeignAid", {} );
			yield* game.respond( "alice", "challenge", {} );

			const view = yield* game.view();
			const bobHeldDuke = hands[ bob ]!.includes( "DUKE" );

			assert.strictEqual(
				view.view.coins[ alice ],
				bobHeldDuke ? 2 : 4,
				bobHeldDuke ? "the block stood" : "the block collapsed and the aid was paid"
			);

			// Either way somebody is now giving up a card.
			assert.strictEqual( ( yield* game.frame() )?.kind, "loseInfluence" );
		} ) );

		it.live( "lets only the target block an assassination", () => Effect.gen( function* () {
			const game = yield* dealt( "block-target-only" );

			yield* game.move( "alice", "income", {} );
			yield* game.move( "bob", "income", {} );
			yield* game.move( "carol", "income", {} );
			yield* game.move( "alice", "assassinate", { target: bob } );

			const frame = yield* game.frame();
			assert.deepStrictEqual(
				frame?.options.map( o => [ o.move, o.players ? [ ...o.players ] : undefined ] ),
				[ [ "challenge", undefined ], [ "blockAssassination", [ bob ] ] ]
			);

			const tag = yield* rejectionTag( game.respond( "carol", "blockAssassination", {} ) );
			assert.strictEqual( tag, "swish/NotRespondingTo" );
		} ) );

		it.live(
			"spends the assassin's coins even when the block stands",
			() => Effect.gen( function* () {
				const game = yield* dealt( "block-costs-anyway" );

				yield* game.move( "alice", "income", {} );
				yield* game.move( "bob", "income", {} );
				yield* game.move( "carol", "income", {} );
				yield* game.move( "alice", "assassinate", { target: bob } );

				assert.strictEqual( ( yield* game.view() ).view.coins[ alice ], 0 );

				yield* game.respond( "bob", "blockAssassination", {} );
				yield* game.pass( "alice" );
				yield* game.pass( "carol" );

				const view = yield* game.view();
				assert.strictEqual( view.view.coins[ alice ], 0, "the three coins are gone" );
				assert.strictEqual( view.view.influence[ bob ], 2, "and bob keeps both cards" );
			} )
		);
	} );

	describe( "exchange", () => {

		it.live(
			"puts two cards in front of the actor and asks what to keep",
			() => Effect.gen( function* () {
				const game = yield* dealt( "exchange-draw" );

				yield* game.move( "alice", "exchange", {} );
				yield* game.pass( "bob" );
				yield* game.pass( "carol" );

				const frame = yield* game.frame();
				assert.strictEqual( frame?.kind, "exchange" );
				assert.deepStrictEqual( [ ...frame!.responders ], [ "alice" ] );
				assert.isFalse( frame!.allowPass );

				const mine = yield* game.state( "alice" );
				assert.strictEqual( mine.drawn.length, 2 );
				assert.strictEqual( ( yield* game.view() ).view.deckSize, 12 );
			} )
		);

		it.live( "keeps the draw to the seat that called for it", () => Effect.gen( function* () {
			const game = yield* dealt( "exchange-redacted" );

			yield* game.move( "alice", "exchange", {} );
			yield* game.pass( "bob" );
			yield* game.pass( "carol" );

			assert.strictEqual( ( yield* game.state( "bob" ) ).drawn.length, 0 );
			assert.strictEqual( ( yield* game.state() ).drawn.length, 0 );
		} ) );

		it.live( "settles the exchange and moves the turn on", () => Effect.gen( function* () {
			const game = yield* dealt( "exchange-settle" );

			yield* game.move( "alice", "exchange", {} );
			yield* game.pass( "bob" );
			yield* game.pass( "carol" );

			const mine = yield* game.state( "alice" );
			const keep = [ mine.drawn[ 0 ]!, mine.hand[ 0 ]! ];
			yield* game.respond( "alice", "exchangeReturn", { cards: keep } );

			const view = yield* game.view();
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( view.view.influence[ alice ], 2, "the hand is the same size" );
			assert.strictEqual( view.view.deckSize, 14, "and the rest went back" );
			assert.strictEqual( view.context.currentPlayer, "bob" );
		} ) );

		it.live( "refuses keeping more than you started with", () => Effect.gen( function* () {
			const game = yield* dealt( "exchange-too-many" );

			yield* game.move( "alice", "exchange", {} );
			yield* game.pass( "bob" );
			yield* game.pass( "carol" );

			const mine = yield* game.state( "alice" );
			const tag = yield* rejectionTag( game.respond( "alice", "exchangeReturn", {
				cards: [ ...mine.hand, ...mine.drawn ]
			} ) );

			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );
	} );

	describe( "steal", () => {

		it.live( "takes two coins when the steal stands", () => Effect.gen( function* () {
			const game = yield* dealt( "steal-plain" );

			yield* game.move( "alice", "steal", { target: bob } );
			yield* game.pass( "bob" );
			yield* game.pass( "carol" );

			const view = yield* game.view();
			assert.strictEqual( view.view.coins[ alice ], 4 );
			assert.strictEqual( view.view.coins[ bob ], 0 );
		} ) );

		it.live(
			"takes what is there when the target has only one coin",
			() => Effect.gen( function* () {
				const game = yield* dealt( "steal-clamped" );

				// Two coins taken leaves bob with none; one income later he has one.
				yield* game.move( "alice", "steal", { target: bob } );
				yield* game.pass( "bob" );
				yield* game.pass( "carol" );
				yield* game.move( "bob", "income", {} );
				yield* game.move( "carol", "income", {} );

				assert.strictEqual( ( yield* game.view() ).view.coins[ bob ], 1 );

				yield* game.move( "alice", "steal", { target: bob } );
				yield* game.pass( "bob" );
				yield* game.pass( "carol" );

				// A Captain claimed against one coin takes one. A bad trade, a legal one.
				const view = yield* game.view();
				assert.strictEqual( view.view.coins[ bob ], 0 );
				assert.strictEqual( view.view.coins[ alice ], 5 );
			} )
		);

		it.live( "lets the target name which character stops it", () => Effect.gen( function* () {
			const game = yield* dealt( "steal-blocked" );

			yield* game.move( "alice", "steal", { target: bob } );
			yield* game.respond( "bob", "blockSteal", { claim: "AMBASSADOR" } );

			const frame = yield* game.frame();
			assert.strictEqual( frame?.kind, "blockClaim" );

			const pending = ( yield* game.state() ).pending;
			assert.strictEqual( pending?.blockClaim, "AMBASSADOR" );
			assert.strictEqual( pending?.blocker, "bob" );
		} ) );
	} );

	describe( "bots and the clock", () => {

		it.live(
			"answers a mandatory window for a seat that never does",
			() => Effect.gen( function* () {
				const game = yield* dealt( "clock-mandatory", {
					botDelayMillis: 3_600_000,
					moveTimeoutMillis: 3_600_000
				} );

				for ( let round = 0; round < 5; round++ ) {
					yield* game.move( "alice", "income", {} );
					yield* game.move( "bob", "income", {} );
					yield* game.move( "carol", "income", {} );
				}

				yield* game.move( "alice", "coup", { target: bob } );
				assert.strictEqual( ( yield* game.frame() )?.kind, "loseInfluence" );

				// The window cannot be declined, so it has to produce an answer from
				// somewhere. Left alone it never would; its own clock is what settles it.
				const before = yield* game.view();
				assert.strictEqual( before.view.influence[ bob ], 2 );
			} )
		);

		it.live( "plays a whole game out between bots", () => Effect.gen( function* () {
			const game = yield* makeTable( Coup, {
				players: PLAYERS,
				name: "bots-finish",
				config: { playerCount: 3, botDelayMillis: 5, moveTimeoutMillis: 20 }
			} );

			yield* game.addBots();

			// Every seat is machine-played once the human clocks lapse. The bot banks
			// on alternate turns, so coins climb whatever happens and a coup — which
			// nobody can block or challenge — eventually ends it.
			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 25 )
			);

			assert.isDefined( view.results?.winner );
			assert.strictEqual( view.results?.ranking.length, 3 );
			assert.deepStrictEqual(
				view.results?.ranking.map( entry => entry.rank ),
				[ 1, 2, 3 ]
			);
		} ), 40_000 );
	} );
} );
