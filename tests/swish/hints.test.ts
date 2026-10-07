import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import { makeTable, rejectionTag } from "@tests/harness/table";
import { makeUsers, seats } from "@tests/harness/users";
import { AskingEngine, AskingEngineLive, AskingStructure } from "@tests/swish/games/asking";
import { FlatEngine, FlatEngineLive, FlatStructure } from "@tests/swish/games/flat";
import { PhasedEngine, PhasedEngineLive, PhasedStructure } from "@tests/swish/games/phased";


const Flat = { Engine: FlatEngine, EngineLive: FlatEngineLive, Structure: FlatStructure };
const Phased = { Engine: PhasedEngine, EngineLive: PhasedEngineLive, Structure: PhasedStructure };
const Asking = { Engine: AskingEngine, EngineLive: AskingEngineLive, Structure: AskingStructure };

const alice = seats.alice.id;
const bob = seats.bob.id;

const DUEL = [ seats.alice, seats.bob ];
const TRIO = [ seats.alice, seats.bob, seats.carol ];

const PARKED = { botDelayMillis: 3_600_000, moveTimeoutMillis: 3_600_000 };

const flat = ( name: string, config = {} ) => makeTable( Flat, {
	players: DUEL,
	name,
	config: { playerCount: 2, allowBonus: true, target: 10, ...PARKED, ...config }
} );

const flatStarted = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* flat( name, config );
	yield* game.joinAll();
	return game;
} );

const asking = ( name: string, config = {} ) => makeTable( Asking, {
	players: TRIO,
	name,
	config: { playerCount: 3, chainDepth: 3, ...PARKED, ...config }
} );

const askingStarted = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* asking( name, config );
	yield* game.joinAll();
	return game;
} );


describe( "swish engine: hints", () => {

	describe( "on a turn", () => {

		it.live(
			"answers the seat to act with what the policy would play",
			() => Effect.gen( function* () {
				const game = yield* flatStarted( "hint-turn" );

				const hint = yield* game.hint( "alice" );
				assert.deepStrictEqual( hint.move, { moveType: "score", input: { points: 1 } } );
			} )
		);

		it.live( "carries no frame, because no window is open", () => Effect.gen( function* () {
			const game = yield* flatStarted( "hint-turn-no-frame" );

			const hint = yield* game.hint( "alice" );
			assert.isUndefined( hint.frameId );
		} ) );

		it.live( "refuses anybody whose turn it is not", () => Effect.gen( function* () {
			// Not answered about alice's turn instead: a hint is about the seat that
			// asked, and there is nothing for bob to do yet.
			const game = yield* flatStarted( "hint-not-your-turn" );

			const tag = yield* rejectionTag( game.hint( "bob" ) );
			assert.strictEqual( tag, "swish/NotYourTurn" );
		} ) );

		it.live( "names whose turn it actually is in the refusal", () => Effect.gen( function* () {
			const game = yield* flatStarted( "hint-not-your-turn-names" );

			const error = yield* Effect.flip( game.hint( "bob" ) ) as Effect.Effect<
				{ playerId: string; currentPlayer: string }
			>;

			assert.strictEqual( error.playerId, bob );
			assert.strictEqual( error.currentPlayer, alice );
		} ) );

		it.live( "answers with no move when the policy declines", () => Effect.gen( function* () {
			// A policy with nothing to say is not a failure — it is an answer about
			// the position, and a different thing from a game that has no policy.
			const game = yield* flatStarted( "hint-declined", { silentBot: true } );

			const hint = yield* game.hint( "alice" );
			assert.isUndefined( hint.move );
		} ) );

		it.live( "agrees with the move the bot actually plays", () => Effect.gen( function* () {
			// The invariant `askMovePolicy` exists to protect: the hint and the turn
			// clock ask the same function the same question.
			const game = yield* flatStarted( "hint-agrees-with-bot", { botDelayMillis: 10 } );

			const hint = yield* game.hint( "alice" );
			yield* game.autoPlay( "alice", true );
			yield* game.waitUntil( got => got.context.currentPlayer === bob );

			const state = yield* game.state();
			assert.strictEqual( hint.move?.moveType, "score" );
			assert.strictEqual( state.scores[ alice ], 1 );
			assert.include( [ ...state.log ], `scored:${ alice }:1` );
		} ) );
	} );

	describe( "on an open window", () => {

		it.live(
			"answers a responder with how the policy would answer",
			() => Effect.gen( function* () {
				const game = yield* askingStarted( "hint-window" );
				yield* game.move( "alice", "ask", {} );

				const hint = yield* game.hint( "bob" );
				assert.deepStrictEqual( hint.move, { moveType: "yes", input: {} } );
			} )
		);

		it.live( "names the window it was computed against", () => Effect.gen( function* () {
			// What a client sends back with the response, and how it can tell a hint
			// about a question from a hint about a turn.
			const game = yield* askingStarted( "hint-window-frame" );
			yield* game.move( "alice", "ask", {} );

			const frame = yield* game.frame();
			const hint = yield* game.hint( "bob" );
			assert.strictEqual( hint.frameId, frame?.id );
		} ) );

		it.live( "reads a secret window as that seat reads it", () => Effect.gen( function* () {
			// `vote` is secret, so the frame the policy is handed has everybody
			// else's answers stripped out of it — the same redaction the seat's own
			// view goes through.
			const game = yield* askingStarted( "hint-window-secret" );
			yield* game.move( "alice", "askAll", {} );
			yield* game.respond( "bob", "vote", { choice: "aye" } );

			const hint = yield* game.hint( "carol" );
			assert.strictEqual( hint.move?.moveType, "vote" );
		} ) );

		it.live( "refuses a seat the window is not asking", () => Effect.gen( function* () {
			// Deliberately not answered about alice's turn. The turn is suspended
			// while a window is open, so a hint about it would be about a position
			// nobody is in.
			const game = yield* askingStarted( "hint-window-bystander" );
			yield* game.move( "alice", "ask", {} );

			const tag = yield* rejectionTag( game.hint( "alice" ) );
			assert.strictEqual( tag, "swish/NotRespondingTo" );
		} ) );

		it.live( "refuses a responder who has already answered", () => Effect.gen( function* () {
			const game = yield* askingStarted( "hint-window-answered" );
			yield* game.move( "alice", "askAll", {} );
			yield* game.respond( "bob", "vote", { choice: "aye" } );

			const tag = yield* rejectionTag( game.hint( "bob" ) );
			assert.strictEqual( tag, "swish/NotRespondingTo" );
		} ) );
	} );

	describe( "a game with no policy to ask", () => {

		it.live( "refuses a turn hint when it declares no botMove", () => Effect.gen( function* () {
			// `asking` answers windows and takes no turns of its own, which is what
			// makes `HintUnavailable` narrower than `AutoPlayUnavailable`: there is a
			// policy here, just not one for this question.
			const game = yield* askingStarted( "hint-no-bot-move" );

			const tag = yield* rejectionTag( game.hint( "alice" ) );
			assert.strictEqual( tag, "swish/HintUnavailable" );
		} ) );

		it.live( "refuses when it declares neither policy", () => Effect.gen( function* () {
			const game = yield* makeTable( Phased, {
				players: DUEL,
				name: "hint-no-policy",
				config: { playerCount: 2, ...PARKED }
			} );

			yield* game.joinAll();

			const tag = yield* rejectionTag( game.hint( "alice" ) );
			assert.strictEqual( tag, "swish/HintUnavailable" );
		} ) );
	} );

	describe( "who may ask", () => {

		it.live( "refuses a table that has not started", () => Effect.gen( function* () {
			const game = yield* flat( "hint-lobby" );

			const tag = yield* rejectionTag( game.hint( "alice" ) );
			assert.strictEqual( tag, "swish/GameNotInProgress" );
		} ) );

		it.live( "refuses somebody with no seat", () => Effect.gen( function* () {
			// `getView` hands a stranger the table's redacted view. A hint has no
			// table-wide answer to hand back, so it refuses instead.
			const game = yield* flatStarted( "hint-stranger" );
			const { mallory } = makeUsers( [ "mallory" ] );

			const tag = yield* rejectionTag( game.run( game.engine.hint( game.ref )( mallory ) ) );
			assert.strictEqual( tag, "swish/NotAMember" );
		} ) );

		it.live( "refuses once the game is over", () => Effect.gen( function* () {
			const game = yield* flatStarted( "hint-completed", { target: 1 } );
			yield* game.move( "alice", "score", { points: 1 } );

			assert.strictEqual( yield* game.status(), "COMPLETED" );
			const tag = yield* rejectionTag( game.hint( "alice" ) );
			assert.strictEqual( tag, "swish/GameNotInProgress" );
		} ) );
	} );

	describe( "what it costs the table", () => {

		it.live(
			"commits nothing and moves neither version nor revision",
			() => Effect.gen( function* () {
				// Asking for help changes nothing about the game, so the open
				// subscriptions have no news — they dedupe on `revision`.
				const game = yield* flatStarted( "hint-is-not-a-write" );
				const before = yield* game.view();

				yield* game.hint( "alice" );
				yield* game.hint( "alice" );

				const after = yield* game.view();
				assert.strictEqual( after.version, before.version );
				assert.strictEqual( after.runtime.revision, before.runtime.revision );
				assert.deepStrictEqual( after.context, before.context );
			} )
		);

		it.live( "is recorded nowhere", () => Effect.gen( function* () {
			const game = yield* flatStarted( "hint-is-not-recorded" );
			yield* game.hint( "alice" );

			const state = yield* game.state();
			assert.deepStrictEqual( [ ...state.log ], [] );
		} ) );
	} );
} );
