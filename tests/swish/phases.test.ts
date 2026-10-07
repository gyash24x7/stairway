import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import { makeTable, rejectionTag } from "@tests/harness/table";
import { seats } from "@tests/harness/users";
import { PhasedEngine, PhasedEngineLive, PhasedStructure } from "@tests/swish/games/phased";


const Phased = {
	Engine: PhasedEngine,
	EngineLive: PhasedEngineLive,
	Structure: PhasedStructure
};

const alice = seats.alice.id;
const bob = seats.bob.id;

const DUEL = [ seats.alice, seats.bob ];

const started = ( name: string, rounds = 2 ) => Effect.gen( function* () {
	const game = yield* makeTable( Phased, {
		players: DUEL,
		name,
		config: { playerCount: 2, rounds }
	} );

	yield* game.joinAll();
	return game;
} );

describe( "swish engine: phases", () => {

	describe( "entering the first phase", () => {

		it.live( "enters `initialPhase` at start", () => Effect.gen( function* () {
			const game = yield* started( "phase-initial" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual( view.context.phase, "opening" );
		} ) );

		it.live(
			"lets the cursor carry over when the phase seats nobody",
			() => Effect.gen( function* () {
				// `opening` supplies no `resolveStartingPlayer`, so whoever `start` left
				// the cursor on keeps it — the absent case the doc comment describes.
				const game = yield* started( "phase-carryover" );
				assert.strictEqual( ( yield* game.context() ).currentPlayer, alice );
			} )
		);

		it.live( "runs no entry events for a phase with no onEnter", () => Effect.gen( function* () {
			const game = yield* started( "phase-no-onenter" );
			const view = yield* game.view();

			assert.strictEqual( view.view.rounds, 0, "`middle` has not been entered yet" );
			assert.deepStrictEqual( [ ...view.view.steps ], [] );
		} ) );
	} );

	describe( "the phase gate", () => {

		it.live( "refuses a move the phase does not list", () => Effect.gen( function* () {
			const game = yield* started( "phase-gate" );
			assert.strictEqual(
				yield* rejectionTag( game.move( "alice", "finish", {} ) ),
				"swish/MoveNotAllowed"
			);
		} ) );

		it.live( "allows the move the phase does list", () => Effect.gen( function* () {
			const game = yield* started( "phase-allows" );
			yield* game.move( "alice", "step", {} );

			assert.deepStrictEqual( [ ...( yield* game.state() ).steps ], [ "opening:alice" ] );
		} ) );
	} );

	describe( "turning over", () => {

		it.live( "runs the next phase's onEnter as it is entered", () => Effect.gen( function* () {
			const game = yield* started( "phase-onenter" );
			yield* game.move( "alice", "step", {} );

			const view = yield* game.view();
			assert.strictEqual( view.context.phase, "middle" );
			assert.strictEqual( view.view.rounds, 1, "`RoundOpened` landed on entry" );
		} ) );

		it.live( "skips the exiting phase's own next-player", () => Effect.gen( function* () {
			// When a move ends the phase, the tail runs `onExit` and turns over
			// instead of asking the phase who plays next — so `opening`'s rotation
			// never happens, and `middle`, which seats nobody, carries the cursor over.
			const game = yield* started( "phase-cursor" );
			yield* game.move( "alice", "step", {} );

			const view = yield* game.view();
			assert.strictEqual( view.context.phase, "middle" );
			assert.strictEqual( view.context.currentPlayer, alice );
		} ) );

		it.live( "does rotate within a phase that has not ended", () => Effect.gen( function* () {
			const game = yield* started( "phase-rotates", 2 );
			yield* game.move( "alice", "step", {} );

			// Now inside `middle`, which needs both seats before it turns over.
			yield* game.move( "alice", "step", {} );
			assert.strictEqual( ( yield* game.context() ).currentPlayer, bob );
		} ) );
	} );

	describe( "a phase that loops back to itself", () => {

		it.live( "re-enters itself and runs onEnter again", () => Effect.gen( function* () {
			// No shipped game has a `resolveNextPhase` that can answer with the phase
			// it was asked about.
			const game = yield* started( "phase-loop", 2 );

			yield* game.move( "alice", "step", {} );
			assert.strictEqual( ( yield* game.state() ).rounds, 1 );

			// `middle` takes one step per seat, then loops back to itself.
			yield* game.move( "alice", "step", {} );
			yield* game.move( "bob", "step", {} );

			const view = yield* game.view();
			assert.strictEqual( view.context.phase, "middle" );
			assert.strictEqual( view.view.rounds, 2, "entered a second time" );
			assert.strictEqual( view.view.roundSteps, 0, "and the round started over" );
		} ) );

		it.live( "gives way once the condition flips", () => Effect.gen( function* () {
			const game = yield* started( "phase-conditional", 1 );

			// `opening` takes one step; `middle` then takes one per seat, and with
			// `rounds: 1` its first turnover hands over to `closing`.
			yield* game.move( "alice", "step", {} );
			yield* game.move( "alice", "step", {} );
			yield* game.move( "bob", "step", {} );

			assert.strictEqual( ( yield* game.context() ).phase, "closing" );
		} ) );
	} );

	describe( "a phase that leaves the cursor alone", () => {

		it.live( "seats its own starting player on entry", () => Effect.gen( function* () {
			const game = yield* started( "phase-closing-seat", 1 );

			yield* game.move( "alice", "step", {} );
			yield* game.move( "alice", "step", {} );
			yield* game.move( "bob", "step", {} );

			// `closing` names `players[ 0 ]` however the last phase left the cursor.
			const view = yield* game.view();
			assert.strictEqual( view.context.phase, "closing" );
			assert.strictEqual( view.context.currentPlayer, alice );
		} ) );

		it.live( "leaves the cursor exactly where the move put it", () => Effect.gen( function* () {
			// `closing` supplies no `resolveNextPlayer`, which no shipped phase does.
			const game = yield* makeTable( Phased, {
				players: DUEL,
				name: "phase-closing-cursor",
				config: { playerCount: 2, rounds: 1 }
			} );

			yield* game.joinAll();
			yield* game.move( "alice", "step", {} );
			yield* game.move( "alice", "step", {} );
			yield* game.move( "bob", "step", {} );

			assert.strictEqual( ( yield* game.context() ).phase, "closing" );

			yield* game.move( "alice", "finish", {} );

			const view = yield* game.view();
			assert.strictEqual( view.status, "COMPLETED" );
			assert.strictEqual( view.context.currentPlayer, alice, "never moved" );
		} ) );
	} );

	describe( "ending", () => {

		it.live(
			"ends between the exit and the entry, so no phase is re-entered",
			() => Effect.gen( function* () {
				// `closing` points back at itself; what stops the loop is the game's own
				// `endIf`, asked between the two.
				const game = yield* started( "phase-end", 1 );

				yield* game.move( "alice", "step", {} );
				yield* game.move( "alice", "step", {} );
				yield* game.move( "bob", "step", {} );
				yield* game.move( "alice", "finish", {} );

				const view = yield* game.view();
				assert.strictEqual( view.status, "COMPLETED" );
				assert.isTrue( view.view.done );
				assert.strictEqual( view.view.rounds, 1, "`middle` was never entered again" );
				assert.strictEqual( view.results?.ranking.length, 2 );
			} )
		);

		it.live( "refuses a move once the game is over", () => Effect.gen( function* () {
			const game = yield* started( "phase-closed", 1 );

			yield* game.move( "alice", "step", {} );
			yield* game.move( "alice", "step", {} );
			yield* game.move( "bob", "step", {} );
			yield* game.move( "alice", "finish", {} );

			assert.strictEqual(
				yield* rejectionTag( game.move( "alice", "finish", {} ) ),
				"swish/GameNotInProgress"
			);
		} ) );
	} );

	describe( "undo across a phase", () => {

		it.live(
			"takes the phase back with the move that turned it over",
			() => Effect.gen( function* () {
				// The phase is folded from the log like everything else, so an undo that
				// removes the turning move removes the turnover too.
				const game = yield* started( "phase-undo" );
				yield* game.move( "alice", "step", {} );

				assert.strictEqual( ( yield* game.context() ).phase, "middle" );

				yield* game.undo( "alice" );

				const view = yield* game.view();
				assert.strictEqual( view.context.phase, "opening" );
				assert.strictEqual( view.view.rounds, 0 );
				assert.deepStrictEqual( [ ...view.view.steps ], [] );
				assert.strictEqual( view.context.currentPlayer, alice );
			} )
		);
	} );
} );
