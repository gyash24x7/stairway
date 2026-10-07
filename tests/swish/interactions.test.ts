import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import { makeTable, rejection, rejectionTag } from "@tests/harness/table";
import { seats } from "@tests/harness/users";
import { AskingEngine, AskingEngineLive, AskingStructure } from "@tests/swish/games/asking";


const Asking = {
	Engine: AskingEngine,
	EngineLive: AskingEngineLive,
	Structure: AskingStructure
};

const alice = seats.alice.id;
const bob = seats.bob.id;
const carol = seats.carol.id;

const TABLE = [ seats.alice, seats.bob, seats.carol ];

const PARKED = { botDelayMillis: 3_600_000, moveTimeoutMillis: 3_600_000 };

const table = ( name: string, config = {} ) => makeTable( Asking, {
	players: TABLE,
	name,
	config: { playerCount: 3, chainDepth: 3, ...PARKED, ...config }
} );

const started = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* table( name, config );
	yield* game.joinAll();
	return game;
} );


describe( "swish engine: interaction windows", () => {

	describe( "a window with no options of its own", () => {

		it.live(
			"offers the kind's whole move list to every responder",
			() => Effect.gen( function* () {
				// Coup always spells its options out, so this default has never run.
				const game = yield* started( "options-default" );
				yield* game.move( "alice", "askAll", {} );

				const frame = yield* game.frame();
				assert.strictEqual( frame?.kind, "vote" );
				assert.deepStrictEqual( frame?.options.map( option => option.move ), [ "vote", "no" ] );

				for ( const option of frame!.options ) {
					assert.isUndefined( option.players, "and to everybody, not a named few" );
				}
			} )
		);

		it.live( "copies the kind's other defaults onto the window", () => Effect.gen( function* () {
			// Written down once on the structure and copied onto the event on the way
			// in, so a structure whose defaults change tomorrow cannot reinterpret a
			// game played today.
			const game = yield* started( "options-defaults-copied" );
			yield* game.move( "alice", "askAll", {} );

			const frame = yield* game.frame();
			assert.strictEqual( frame?.resolution, "all" );
			assert.isTrue( frame!.allowPass );
			assert.isTrue( frame!.secret );
			assert.isUndefined( frame?.timeoutMillis );
		} ) );

		it.live( "keeps the options a window did name", () => Effect.gen( function* () {
			const game = yield* started( "options-explicit" );
			yield* game.move( "alice", "ask", {} );

			const frame = yield* game.frame();
			assert.deepStrictEqual( frame?.options.map( option => option.move ), [ "yes" ] );
		} ) );
	} );

	describe( "a window with no timeout", () => {

		it.live( "keeps no clock, and stays open indefinitely", () => Effect.gen( function* () {
			// Coup times every window out; a window that never closes on its own has
			// never been left alone.
			const game = yield* started( "no-timeout", { botDelayMillis: 3_600_000 } );
			yield* game.move( "alice", "ask", {} );

			const view = yield* game.view();
			assert.isUndefined( view.runtime.interactionDeadline );

			yield* Effect.sleep( Duration.millis( 120 ) );

			const after = yield* game.frame();
			assert.strictEqual( after?.kind, "open" );
			assert.deepStrictEqual( [ ...after!.pending ], [ bob, carol ] );
		} ) );
	} );

	describe( "a secret, all-answer window", () => {

		const voting = ( name: string ) => Effect.gen( function* () {
			const game = yield* started( name );
			yield* game.move( "alice", "askAll", {} );
			return game;
		} );

		it.live( "waits for every responder", () => Effect.gen( function* () {
			const game = yield* voting( "secret-all" );
			yield* game.respond( "bob", "vote", { choice: "aye" } );

			const frame = yield* game.frame();
			assert.deepStrictEqual( [ ...frame!.pending ], [ carol ], "carol is still asked" );
		} ) );

		it.live(
			"hides an answer from the other responders while it is open",
			() => Effect.gen( function* () {
				// Without this, an `all` window is answered in whatever order people
				// happen to click and each answer is news to everybody still deciding.
				const game = yield* voting( "secret-hidden" );
				yield* game.respond( "bob", "vote", { choice: "aye" } );

				const theirs = ( yield* game.view( "carol" ) ).context.interactions.at( -1 )!;
				const bobsAnswer = theirs.responses.find( response => response.playerId === bob );

				assert.isDefined( bobsAnswer, "carol can see that bob has answered" );
				assert.isUndefined( bobsAnswer?.move, "but not what he said" );
			} )
		);

		it.live( "shows a responder their own answer", () => Effect.gen( function* () {
			const game = yield* voting( "secret-own" );
			yield* game.respond( "bob", "vote", { choice: "aye" } );

			const mine = ( yield* game.view( "bob" ) ).context.interactions.at( -1 )!;
			assert.strictEqual(
				mine.responses.find( response => response.playerId === bob )?.move,
				"vote"
			);
		} ) );

		it.live( "hides every answer from the table", () => Effect.gen( function* () {
			const game = yield* voting( "secret-table" );
			yield* game.respond( "bob", "vote", { choice: "aye" } );

			const table = ( yield* game.view() ).context.interactions.at( -1 )!;
			for ( const response of table.responses ) {
				assert.isUndefined( response.move );
			}
		} ) );

		it.live( "settles only once the last answer is in", () => Effect.gen( function* () {
			const game = yield* voting( "secret-settle" );

			yield* game.respond( "bob", "vote", { choice: "aye" } );
			assert.isDefined( yield* game.frame() );

			yield* game.respond( "carol", "vote", { choice: "nay" } );

			const view = yield* game.view();
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( view.view.settled, 1 );

			// Both answers reach `onResolve`, in the order they were given.
			assert.deepStrictEqual(
				view.view.log.filter( entry => entry.startsWith( "vote:" ) ),
				[ "vote:bob:vote", "vote:carol:vote" ]
			);
		} ) );

		it.live(
			"takes a pass as an answer for the purpose of closing",
			() => Effect.gen( function* () {
				const game = yield* voting( "secret-pass" );

				yield* game.pass( "bob" );
				yield* game.pass( "carol" );

				const view = yield* game.view();
				assert.isUndefined( yield* game.frame() );
				assert.strictEqual( view.view.settled, 1 );

				// A pass is not an answer, so `onResolve` sees none.
				assert.deepStrictEqual( view.view.log.filter( entry => entry.startsWith( "vote:" ) ), [] );
			} )
		);
	} );

	describe( "a window nobody is being asked", () => {

		it.live( "settles the instant it appears", () => Effect.gen( function* () {
			// A window opened against a table with nobody left to ask would otherwise
			// sit there holding a turn that nothing can release.
			const game = yield* started( "empty-window" );
			yield* game.move( "alice", "askNobody", {} );

			const view = yield* game.view();
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( view.view.settled, 1 );
			assert.strictEqual( view.context.currentPlayer, bob, "and the turn moves on" );
			assert.isUndefined( view.context.suspended );
		} ) );
	} );

	describe( "windows opened from a lifecycle hook", () => {

		it.live( "opens one at start, before anybody has taken a turn", () => Effect.gen( function* () {
			const game = yield* started( "hook-start", { askAtStart: true } );

			const frame = yield* game.frame();
			assert.strictEqual( frame?.kind, "open" );
			assert.strictEqual( frame?.initiator, alice );
			assert.deepStrictEqual( [ ...frame!.responders ], [ bob, carol ] );
		} ) );

		it.live( "holds the first turn until that window settles", () => Effect.gen( function* () {
			const game = yield* started( "hook-start-holds", { askAtStart: true } );

			assert.strictEqual(
				yield* rejectionTag( game.move( "alice", "ask", {} ) ),
				"swish/InteractionInProgress"
			);

			yield* game.respond( "bob", "yes", {} );

			assert.isUndefined( yield* game.frame() );
			yield* game.move( "alice", "ask", {} );
		} ) );

		it.live(
			"opens one from a join, before the table is even full",
			() => Effect.gen( function* () {
				const game = yield* table( "hook-join", { askOnJoin: true } );
				yield* game.join( "bob" );

				const frame = yield* game.frame();
				assert.strictEqual( frame?.kind, "open" );
				assert.strictEqual( frame?.initiator, bob );
				assert.deepStrictEqual( [ ...frame!.responders ], [ alice ] );
			} )
		);

		it.live( "opens one from afterMove, alongside the move's own", () => Effect.gen( function* () {
			const game = yield* started( "hook-after", { askAfterMove: true } );
			yield* game.move( "alice", "ask", {} );

			// Two windows on the stack: the move's, and the hook's on top of it.
			const view = yield* game.view();
			assert.strictEqual( view.context.interactions.length, 2 );
			assert.strictEqual( ( yield* game.frame() )?.id, view.context.interactions.at( -1 )?.id );
		} ) );

		it.live( "settles a nested pair innermost first", () => Effect.gen( function* () {
			// A window opened while another is open is a question about that
			// question, and has to be settled before the one underneath it can be.
			const game = yield* started( "hook-nested", { askAfterMove: true } );
			yield* game.move( "alice", "ask", {} );

			const inner = ( yield* game.frame() )!.id;

			yield* game.respond( "bob", "yes", {} );

			const middle = yield* game.frame();
			assert.isDefined( middle, "the outer window is still open" );
			assert.notStrictEqual( middle?.id, inner );

			yield* game.respond( "bob", "yes", {} );

			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( ( yield* game.state() ).settled, 2 );
		} ) );
	} );

	describe( "the turn while a window is open", () => {

		const asked = ( name: string ) => Effect.gen( function* () {
			const game = yield* started( name );
			yield* game.move( "alice", "ask", {} );
			return game;
		} );

		it.live( "suspends the turn rather than passing it on", () => Effect.gen( function* () {
			const game = yield* asked( "turn-suspended" );
			const view = yield* game.view();

			assert.strictEqual( view.context.currentPlayer, alice );
			assert.strictEqual( view.context.suspended?.actor, alice );
			assert.strictEqual( view.context.suspended?.moveType, "ask" );
		} ) );

		it.live( "picks the turn back up where it left off", () => Effect.gen( function* () {
			const game = yield* asked( "turn-resumed" );
			yield* game.respond( "bob", "yes", {} );

			const view = yield* game.view();
			assert.isUndefined( view.context.suspended );
			assert.strictEqual( view.context.currentPlayer, bob, "one past alice" );
			assert.strictEqual( view.context.turn, 1 );
		} ) );

		it.live( "will not let the game end while a window is open", () => Effect.gen( function* () {
			const game = yield* started( "turn-no-end", { askAfterMove: true } );
			yield* game.move( "alice", "ask", {} );

			// `stop` would end the game, but it is not one of the window's moves.
			assert.strictEqual(
				yield* rejectionTag( game.move( "bob", "stop", {} ) ),
				"swish/NotRespondingTo"
			);

			assert.strictEqual( ( yield* game.view() ).status, "IN_PROGRESS" );
		} ) );

		it.live( "refuses an undo while one is open", () => Effect.gen( function* () {
			const game = yield* asked( "turn-no-undo" );
			assert.strictEqual(
				yield* rejectionTag( game.undo( "alice" ) ),
				"swish/InteractionInProgress"
			);
		} ) );

		it.live( "tells a seat it is not the one being asked", () => Effect.gen( function* () {
			const game = yield* asked( "turn-not-asked" );
			assert.strictEqual(
				yield* rejectionTag( game.move( "alice", "ask", {} ) ),
				"swish/InteractionInProgress"
			);
		} ) );

		it.live( "refuses a move the window does not list", () => Effect.gen( function* () {
			const game = yield* asked( "turn-wrong-move" );
			assert.strictEqual(
				yield* rejectionTag( game.respond( "bob", "no", {} ) ),
				"swish/NotRespondingTo"
			);
		} ) );
	} );

	describe( "passing", () => {

		it.live( "takes one responder off and leaves the window open", () => Effect.gen( function* () {
			// A pass is one seat's answer and never the table's.
			const game = yield* started( "pass-one" );
			yield* game.move( "alice", "askAll", {} );
			yield* game.pass( "bob" );

			const frame = yield* game.frame();
			assert.deepStrictEqual( [ ...frame!.pending ], [ carol ] );
		} ) );

		it.live(
			"settles a `first` window when the last responder declines",
			() => Effect.gen( function* () {
				const game = yield* started( "pass-all" );
				yield* game.move( "alice", "ask", {} );

				yield* game.pass( "bob" );
				assert.isDefined( yield* game.frame() );

				yield* game.pass( "carol" );

				const view = yield* game.view();
				assert.isUndefined( yield* game.frame() );
				assert.strictEqual( view.view.settled, 1 );
				assert.deepStrictEqual(
					view.view.log.filter( entry => entry.startsWith( "open:" ) ),
					[],
					"nobody answered"
				);
			} )
		);

		it.live( "refuses a pass from somebody not being asked", () => Effect.gen( function* () {
			const game = yield* started( "pass-wrong" );
			yield* game.move( "alice", "ask", {} );

			assert.strictEqual( yield* rejectionTag( game.pass( "alice" ) ), "swish/NotRespondingTo" );
		} ) );

		it.live( "refuses a pass naming a stale frame", () => Effect.gen( function* () {
			// The race is real: one answer can settle a window and open the next in
			// the same commit, so a click made against the first can land while the
			// second is open.
			const game = yield* started( "pass-stale" );
			yield* game.move( "alice", "ask", {} );

			assert.strictEqual(
				yield* rejectionTag( game.pass( "bob", "not-this-one" ) ),
				"swish/InteractionStale"
			);
		} ) );

		it.live( "refuses a pass with nothing open", () => Effect.gen( function* () {
			const game = yield* started( "pass-none" );
			assert.strictEqual( yield* rejectionTag( game.pass( "bob" ) ), "swish/InteractionNotOpen" );
		} ) );
	} );

	describe( "a `first` window", () => {

		it.live( "settles on the first answer and never asks the rest", () => Effect.gen( function* () {
			const game = yield* started( "first-race" );
			yield* game.move( "alice", "ask", {} );
			yield* game.respond( "bob", "yes", {} );

			const view = yield* game.view();
			assert.isUndefined( yield* game.frame() );
			assert.deepStrictEqual(
				view.view.log.filter( entry => entry.startsWith( "open:" ) ),
				[ "open:bob:yes" ]
			);
		} ) );

		it.live( "leaves the second responder nothing to answer", () => Effect.gen( function* () {
			const game = yield* started( "first-too-late" );
			yield* game.move( "alice", "ask", {} );
			yield* game.respond( "bob", "yes", {} );

			// The window is gone, so carol's `yes` is read as a turn action — and it
			// is not her turn.
			assert.strictEqual(
				yield* rejectionTag( game.respond( "carol", "yes", {} ) ),
				"swish/NotYourTurn"
			);
		} ) );
	} );

	describe( "the cascade guard", () => {

		it.live( "unwinds a bounded chain without complaint", () => Effect.gen( function* () {
			const game = yield* started( "chain-bounded", { chainDepth: 4 } );
			yield* game.move( "alice", "startChain", {} );

			const view = yield* game.view();
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( view.view.settled, 5, "each link settled in the one commit" );
			assert.strictEqual( view.context.currentPlayer, bob );
		} ) );

		it.live( "refuses rather than folding events forever", () => Effect.gen( function* () {
			// A game whose windows resolve into each other without end would
			// otherwise fold events until it ran out of memory. The refusal is what
			// makes the guard stop something: a defect would restart the entity and
			// redeliver this command, so the table would spin instead.
			const game = yield* started( "chain-runaway", { chainDepth: 1_000 } );

			const error = yield* rejection( game.move( "alice", "startChain", {} ) );
			assert.strictEqual( ( error as { _tag: string } )._tag, "swish/InteractionCascade" );
		} ) );

		it.live( "leaves the table exactly as it found it", () => Effect.gen( function* () {
			const game = yield* started( "chain-discarded", { chainDepth: 1_000 } );
			const before = yield* game.view();

			yield* rejectionTag( game.move( "alice", "startChain", {} ) );

			// The commit is discarded whole, so nothing of the runaway chain lands.
			const after = yield* game.view();
			assert.strictEqual( after.version, before.version );
			assert.strictEqual( after.view.settled, 0 );
			assert.isUndefined( yield* game.frame() );
			assert.strictEqual( after.context.currentPlayer, alice );
		} ) );
	} );

	describe( "bots answering a window", () => {

		it.live(
			"answers for a machine-played responder once its delay is up",
			() => Effect.gen( function* () {
				const game = yield* makeTable( Asking, {
					players: TABLE,
					name: "bot-responds",
					config: { playerCount: 3, chainDepth: 3, botDelayMillis: 5, moveTimeoutMillis: 20 }
				} );

				yield* game.joinAll();
				yield* game.autoPlay( "bob", true );
				yield* game.move( "alice", "ask", {} );

				// The window has no clock of its own, so the only thing that can settle
				// it is a responder being asked for an answer.
				const view = yield* game.waitUntil(
					got => got.view.settled > 0,
					Duration.seconds( 5 )
				);

				assert.strictEqual( view.view.settled, 1 );
				assert.deepStrictEqual(
					view.view.log.filter( entry => entry.startsWith( "open:" ) ),
					[ "open:bob:yes" ]
				);
			} )
		);
	} );
} );
