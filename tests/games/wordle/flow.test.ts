import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import type { Table } from "@tests/harness/table";
import { makeTable, PARKED, rejectionTag } from "@tests/harness/table";
import { makeUsers } from "@tests/harness/users";

import { WordleEngine, WordleEngineLive, WordleStructure } from "@/games/wordle/server/engine";
import type { PlayerId } from "@/swish/schema";


const Wordle = {
	Engine: WordleEngine,
	EngineLive: WordleEngineLive,
	Structure: WordleStructure
};

const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;

const DUEL = Object.values( makeUsers( [ "alice", "bob" ] as const ) );

/** A solitaire table, started, with the clocks parked. */
const solo = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* makeTable( Wordle, {
		players: DUEL.slice( 0, 1 ),
		name,
		config: { playerCount: 1, wordCount: 1, wordLength: 5, ...PARKED, ...config }
	} );

	return game;
} );

/** A two-seat race, started, with the clocks parked. */
const duel = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* makeTable( Wordle, {
		players: DUEL,
		name,
		config: { playerCount: 2, wordCount: 1, wordLength: 5, ...PARKED, ...config }
	} );

	yield* game.joinAll();
	return game;
} );

/**
 * The words this table is hiding, taken the only honest way: play a seat out to
 * the end of its allowance so the game decides and publishes them.
 */
const answersOf = ( game: Table<typeof WordleStructure> ) => Effect.gen( function* () {
	const view = yield* game.view();
	return view.view.answers;
} );


describe( "wordle flow", () => {

	describe( "the board", () => {

		it.live( "starts solitaire on its own", () => Effect.gen( function* () {
			const game = yield* solo( "board-solo" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual( view.view.boards.length, 1 );
			assert.strictEqual( view.view.maxGuesses, 6 );
			assert.isFalse( view.view.decided );
		} ) );

		it.live( "hides as many words as the table was created for", () => Effect.gen( function* () {
			const game = yield* solo( "board-words", { wordCount: 3 } );
			const view = yield* game.view();

			assert.strictEqual( view.view.boards[ 0 ]?.solvedWords.length, 3 );
			assert.strictEqual( view.view.maxGuesses, 8 );
		} ) );

		it.live( "hides distinct words", () => Effect.gen( function* () {
			// `setup` shuffles the dictionary and takes a prefix, so the words are
			// distinct by construction rather than by rejection sampling.
			const game = yield* solo( "board-distinct", { wordCount: 4 } );
			for ( let i = 0; i < 9; i++ ) {
				yield* game.move( "alice", "guess", { guess: "spout" } );
			}

			const answers = yield* answersOf( game );
			assert.strictEqual( new Set( answers ).size, answers?.length );
		} ) );

		it.live( "plays at other word lengths", () => Effect.gen( function* () {
			const game = yield* solo( "board-four", { wordLength: 4 } );

			assert.strictEqual( ( yield* game.view() ).view.maxGuesses, 5 );

			const tag = yield* rejectionTag( game.move( "alice", "guess", { guess: "spout" } ) );
			assert.strictEqual( tag, "swish/InvalidMove" );

			yield* game.move( "alice", "guess", { guess: "spot" } );
			assert.strictEqual( ( yield* game.view() ).view.boards[ 0 ]?.guessCount, 1 );
		} ) );
	} );

	describe( "guessing", () => {

		it.live( "scores a guess and keeps the board open", () => Effect.gen( function* () {
			const game = yield* solo( "guess-scores" );
			yield* game.move( "alice", "guess", { guess: "spout" } );

			const board = ( yield* game.state( "alice" ) ).boards[ 0 ]!;
			assert.deepStrictEqual( [ ...board.guesses ], [ "spout" ] );
			assert.strictEqual( board.results[ 0 ]?.length, 1 );
			assert.strictEqual( board.results[ 0 ]?.[ 0 ]?.length, 5 );
			assert.isFalse( board.finished );
		} ) );

		it.live( "refuses an unknown word", () => Effect.gen( function* () {
			const game = yield* solo( "guess-unknown" );
			const tag = yield* rejectionTag( game.move( "alice", "guess", { guess: "zzzzz" } ) );
			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "accepts a guess in any case", () => Effect.gen( function* () {
			const game = yield* solo( "guess-case" );
			yield* game.move( "alice", "guess", { guess: "SPOUT" } );

			assert.deepStrictEqual(
				[ ...( yield* game.state( "alice" ) ).boards[ 0 ]!.guesses ],
				[ "spout" ]
			);
		} ) );

		it.live( "finishes the board when the allowance runs out", () => Effect.gen( function* () {
			const game = yield* solo( "guess-exhausted" );
			const words = [ "spout", "abbey", "aback", "abase", "abate", "abbot" ];

			for ( const guess of words ) {
				yield* game.move( "alice", "guess", { guess } );
			}

			const view = yield* game.view();
			assert.strictEqual( view.status, "COMPLETED" );
			assert.isTrue( view.view.decided );
			assert.isTrue( view.view.boards[ 0 ]!.finished );
		} ) );

		it.live( "refuses a guess once the board is finished", () => Effect.gen( function* () {
			const game = yield* solo( "guess-after-end" );
			for ( const guess of [ "spout", "abbey", "aback", "abase", "abate", "abbot" ] ) {
				yield* game.move( "alice", "guess", { guess } );
			}

			const tag = yield* rejectionTag( game.move( "alice", "guess", { guess: "crane" } ) );
			assert.strictEqual( tag, "swish/GameNotInProgress" );
		} ) );

		it.live( "reveals the answers only once the game is decided", () => Effect.gen( function* () {
			const game = yield* solo( "guess-answers" );

			yield* game.move( "alice", "guess", { guess: "spout" } );
			assert.isUndefined( ( yield* game.state( "alice" ) ).answers );

			for ( const guess of [ "abbey", "aback", "abase", "abate", "abbot" ] ) {
				yield* game.move( "alice", "guess", { guess } );
			}

			const answers = yield* answersOf( game );
			assert.strictEqual( answers?.length, 1 );
			assert.strictEqual( answers?.[ 0 ]?.length, 5 );
		} ) );

		it.live( "ends the moment the last word is solved", () => Effect.gen( function* () {
			const game = yield* solo( "guess-solved" );

			// Burn the allowance to learn the word, then play the same table again
			// and solve it outright — the deal is a function of the table's id.
			for ( const guess of [ "spout", "abbey", "aback", "abase", "abate", "abbot" ] ) {
				yield* game.move( "alice", "guess", { guess } );
			}

			const answer = ( yield* answersOf( game ) )![ 0 ]!;

			const rerun = yield* solo( "guess-solved" );
			yield* rerun.move( "alice", "guess", { guess: answer } );

			const view = yield* rerun.view();
			assert.strictEqual( view.status, "COMPLETED" );
			assert.strictEqual( view.view.boards[ 0 ]?.guessCount, 1 );
			assert.deepStrictEqual( [ ...view.view.boards[ 0 ]!.solvedWords ], [ true ] );
			assert.isAbove( view.results?.ranking[ 0 ]?.score ?? 0, 0 );
		} ) );
	} );

	describe( "forfeiting", () => {

		it.live( "ends a solitaire table outright", () => Effect.gen( function* () {
			const game = yield* solo( "forfeit-solo" );
			yield* game.move( "alice", "forfeit", {} );

			const view = yield* game.view();
			assert.strictEqual( view.status, "COMPLETED" );
			assert.isTrue( view.view.boards[ 0 ]!.finished );
		} ) );

		it.live( "charges the whole allowance", () => Effect.gen( function* () {
			const game = yield* solo( "forfeit-charged" );

			yield* game.move( "alice", "guess", { guess: "spout" } );
			yield* game.move( "alice", "forfeit", {} );

			// One guess played, but the board is finished and scored as if all six
			// were spent — which is what stops a hard board being ended cheaply.
			const board = ( yield* game.view() ).view.boards[ 0 ]!;
			assert.strictEqual( board.guessCount, 1 );
			assert.strictEqual( board.score, 0 );
		} ) );

		it.live( "refuses a second forfeit", () => Effect.gen( function* () {
			const game = yield* duel( "forfeit-twice" );
			yield* game.move( "alice", "forfeit", {} );

			// `canMove` is the gate and it runs first, so a finished seat is turned
			// away before its own `validate` — which is the backstop — is ever asked.
			const tag = yield* rejectionTag( game.move( "alice", "forfeit", {} ) );
			assert.strictEqual( tag, "swish/NotYourTurn" );
		} ) );
	} );

	describe( "the race", () => {

		it.live( "lets either seat guess, whoever the cursor is on", () => Effect.gen( function* () {
			const game = yield* duel( "race-out-of-turn" );

			assert.strictEqual( ( yield* game.context() ).currentPlayer, alice );

			// Bob plays first anyway. A wordle is a race, not a turn order.
			yield* game.move( "bob", "guess", { guess: "spout" } );

			const view = yield* game.view();
			assert.strictEqual( view.view.boards[ 1 ]?.guessCount, 1 );
			assert.strictEqual( view.view.boards[ 0 ]?.guessCount, 0 );
		} ) );

		it.live(
			"keeps each seat's rows to itself while the game runs",
			() => Effect.gen( function* () {
				const game = yield* duel( "race-redaction" );

				yield* game.move( "alice", "guess", { guess: "spout" } );
				yield* game.move( "bob", "guess", { guess: "abbey" } );

				const mine = ( yield* game.state( "alice" ) ).boards;
				assert.deepStrictEqual( [ ...mine[ 0 ]!.guesses ], [ "spout" ] );
				assert.deepStrictEqual( [ ...mine[ 1 ]!.guesses ], [] );
				assert.deepStrictEqual( [ ...mine[ 1 ]!.results ], [] );
				assert.strictEqual( mine[ 1 ]!.guessCount, 1, "but the size is public" );
			} )
		);

		it.live( "keeps going after one seat finishes", () => Effect.gen( function* () {
			// A race ends last, not first: a seat that finishes early is simply done,
			// and the others keep their allowance.
			const game = yield* duel( "race-ends-last" );
			yield* game.move( "alice", "forfeit", {} );

			const view = yield* game.view();
			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.isTrue( view.view.boards[ 0 ]!.finished );
			assert.isFalse( view.view.boards[ 1 ]!.finished );

			yield* game.move( "bob", "guess", { guess: "spout" } );
			assert.strictEqual( ( yield* game.view() ).status, "IN_PROGRESS" );
		} ) );

		it.live( "parks the cursor on a seat that can still play", () => Effect.gen( function* () {
			const game = yield* duel( "race-cursor" );

			yield* game.move( "bob", "forfeit", {} );
			yield* game.move( "alice", "guess", { guess: "spout" } );

			// Bob is finished, so the cursor comes back to alice rather than stalling
			// on a seat with nothing to play.
			assert.strictEqual( ( yield* game.context() ).currentPlayer, alice );
		} ) );

		it.live(
			"ends once both seats are done, and opens every board",
			() => Effect.gen( function* () {
				const game = yield* duel( "race-decided" );

				yield* game.move( "alice", "guess", { guess: "spout" } );
				yield* game.move( "alice", "forfeit", {} );
				yield* game.move( "bob", "guess", { guess: "abbey" } );
				yield* game.move( "bob", "forfeit", {} );

				const view = yield* game.view();
				assert.strictEqual( view.status, "COMPLETED" );
				assert.isTrue( view.view.decided );

				// Once decided, a seat may read every board.
				const mine = ( yield* game.state( "alice" ) ).boards;
				assert.deepStrictEqual( [ ...mine[ 1 ]!.guesses ], [ "abbey" ] );
			} )
		);

		it.live( "ranks a solver above a seat that gave up", () => Effect.gen( function* () {
			const game = yield* duel( "race-ranking" );

			for ( const guess of [ "spout", "abbey", "aback", "abase", "abate", "abbot" ] ) {
				yield* game.move( "alice", "guess", { guess } );
			}
			yield* game.move( "bob", "forfeit", {} );

			const answer = ( yield* answersOf( game ) )![ 0 ]!;

			const rerun = yield* duel( "race-ranking" );
			yield* rerun.move( "alice", "guess", { guess: answer } );
			yield* rerun.move( "bob", "forfeit", {} );

			const view = yield* rerun.view();
			assert.strictEqual( view.status, "COMPLETED" );
			assert.strictEqual( view.results?.winner, alice );
			assert.deepStrictEqual(
				view.results?.ranking.map( entry => [ entry.playerId, entry.rank ] ),
				[ [ alice, 1 ], [ bob, 2 ] ]
			);
		} ) );

		it.live( "names no winner when both seats score nothing", () => Effect.gen( function* () {
			const game = yield* duel( "race-tied" );

			yield* game.move( "alice", "forfeit", {} );
			yield* game.move( "bob", "forfeit", {} );

			const view = yield* game.view();
			assert.isUndefined( view.results?.winner );
			assert.deepStrictEqual( view.results?.ranking.map( entry => entry.rank ), [ 1, 1 ] );
		} ) );
	} );

	describe( "undo", () => {

		it.live( "takes a guess back", () => Effect.gen( function* () {
			const game = yield* solo( "undo-guess" );
			yield* game.move( "alice", "guess", { guess: "spout" } );
			yield* game.undo( "alice" );

			assert.strictEqual( ( yield* game.view() ).view.boards[ 0 ]?.guessCount, 0 );
		} ) );

		it.live( "refuses to take back a rival's guess", () => Effect.gen( function* () {
			const game = yield* duel( "undo-rival" );
			yield* game.move( "bob", "guess", { guess: "spout" } );

			const tag = yield* rejectionTag( game.undo( "alice" ) );
			assert.strictEqual( tag, "swish/UndoNotAllowed" );
		} ) );
	} );

	describe( "bots and the clock", () => {

		it.live( "plays a solitaire board out on its own", () => Effect.gen( function* () {
			const game = yield* makeTable( Wordle, {
				players: DUEL.slice( 0, 1 ),
				name: "bot-solo",
				config: {
					playerCount: 1,
					wordCount: 1,
					wordLength: 5,
					botDelayMillis: 5,
					moveTimeoutMillis: 20
				}
			} );

			// The seat lapses, is handed to the policy, and the policy plays it out.
			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 20 )
			);

			assert.isTrue( view.view.decided );
			assert.isTrue( view.view.boards[ 0 ]!.finished );
		} ), 30_000 );

		it.live( "races two machine-played seats side by side", () => Effect.gen( function* () {
			const game = yield* makeTable( Wordle, {
				players: DUEL,
				name: "bot-duel",
				config: {
					playerCount: 2,
					wordCount: 1,
					wordLength: 5,
					botDelayMillis: 5,
					moveTimeoutMillis: 20
				}
			} );

			yield* game.joinAll();

			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 25 )
			);

			// Both seats race on the one shared clock, so neither waits for the
			// cursor to come round to it.
			assert.strictEqual( view.view.boards.length, 2 );
			for ( const board of view.view.boards ) {
				assert.isTrue( board.finished );
			}
		} ), 40_000 );

		it.live( "races the bots while a person is still thinking", () => Effect.gen( function* () {
			// The cursor opens on alice, a person with all the time in the world.
			// Paced through the cursor, the bots would wait on her for as long as she
			// took; racing, they play their boards out around her.
			const game = yield* makeTable( Wordle, {
				players: DUEL.slice( 0, 1 ),
				name: "bot-race-around",
				config: {
					playerCount: 3,
					wordCount: 1,
					wordLength: 5,
					botDelayMillis: 5,
					moveTimeoutMillis: 3_600_000
				}
			} );

			yield* game.addBots( "alice" );

			const view = yield* game.waitUntil(
				got => got.view.boards.slice( 1 ).every( board => board.finished ),
				Duration.seconds( 25 )
			);

			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual( view.view.boards[ 0 ]!.guessCount, 0 );
			assert.strictEqual( view.context.currentPlayer, alice, "nobody else's guess took her turn" );
			assert.isDefined( view.runtime.deadline, "and her own clock is still the one on show" );
		} ), 40_000 );
	} );
} );
