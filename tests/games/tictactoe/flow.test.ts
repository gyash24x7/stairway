import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";

import { assert, describe, it } from "@effect/vitest";

import { makeTable, PARKED, rejectionTag } from "@tests/harness/table";
import { makeUsers, seats } from "@tests/harness/users";

import {
	TicTacToeEngine,
	TicTacToeEngineLive,
	TicTacToeStructure
} from "@/games/tictactoe/server/engine";


const TicTacToe = {
	Engine: TicTacToeEngine,
	EngineLive: TicTacToeEngineLive,
	Structure: TicTacToeStructure
};

const table = ( name: string, config = {} ) =>
	makeTable( TicTacToe, { seats: 2, name, config: { ...PARKED, ...config } } );

/** Seats both players and returns the started table. */
const started = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* table( name, config );
	yield* game.joinAll();
	return game;
} );


describe( "tictactoe flow", () => {

	describe( "lobby", () => {

		it.live( "opens with the creator seated and the table waiting", () => Effect.gen( function* () {
			const game = yield* table( "lobby-open" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "CREATED" );
			assert.deepStrictEqual( [ ...view.context.players ], [ "alice" ] );

			// The cursor is stamped as the first seat is taken, not at `start`.
			assert.strictEqual( view.context.currentPlayer, "alice" );
		} ) );

		it.live( "starts itself when the second seat is taken", () => Effect.gen( function* () {
			const game = yield* table( "lobby-autostart" );
			yield* game.join( "bob" );

			const view = yield* game.view();
			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual( view.context.currentPlayer, "alice" );
		} ) );

		it.live( "refuses a third seat", () => Effect.gen( function* () {
			const game = yield* makeTable( TicTacToe, {
				players: Object.values( makeUsers( [ "alice", "bob", "carol" ] as const ) ),
				name: "lobby-full",
				config: PARKED
			} );

			yield* game.join( "bob" );
			const tag = yield* rejectionTag( game.join( "carol" ) );
			assert.strictEqual( tag, "swish/GameNotJoinable" );
		} ) );

		it.live( "refuses the same player twice", () => Effect.gen( function* () {
			const game = yield* table( "lobby-twice" );
			const tag = yield* rejectionTag( game.join( "alice" ) );
			assert.strictEqual( tag, "swish/AlreadyJoined" );
		} ) );

		it.live( "gives the two seats different marks", () => Effect.gen( function* () {
			const game = yield* started( "lobby-marks" );
			const state = yield* game.state();

			assert.strictEqual( state.symbols.X, "alice" );
			assert.strictEqual( state.symbols.O, "bob" );
		} ) );

		it.live( "fills the table with a bot on request", () => Effect.gen( function* () {
			const game = yield* table( "lobby-bots" );
			yield* game.addBots();

			const view = yield* game.view();
			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual( view.context.players.length, 2 );

			const seats = Object.values( view.players );
			assert.strictEqual( seats.filter( seat => seat.isBot === true ).length, 1 );
		} ) );
	} );

	describe( "turns", () => {

		it.live( "passes the turn to the other seat", () => Effect.gen( function* () {
			const game = yield* started( "turn-pass" );

			yield* game.move( "alice", "place", { position: 0 } );
			assert.strictEqual( yield* game.current(), "bob" );

			yield* game.move( "bob", "place", { position: 1 } );
			assert.strictEqual( yield* game.current(), "alice" );
		} ) );

		it.live( "counts a turn per move", () => Effect.gen( function* () {
			const game = yield* started( "turn-count" );

			assert.strictEqual( ( yield* game.context() ).turn, 0 );
			yield* game.move( "alice", "place", { position: 0 } );
			assert.strictEqual( ( yield* game.context() ).turn, 1 );
			yield* game.move( "bob", "place", { position: 1 } );
			assert.strictEqual( ( yield* game.context() ).turn, 2 );
		} ) );

		it.live( "refuses a move out of turn", () => Effect.gen( function* () {
			const game = yield* started( "turn-order" );
			const tag = yield* rejectionTag( game.move( "bob", "place", { position: 0 } ) );
			assert.strictEqual( tag, "swish/NotYourTurn" );
		} ) );

		it.live( "refuses an occupied cell with the game's own reason", () => Effect.gen( function* () {
			const game = yield* started( "turn-occupied" );
			yield* game.move( "alice", "place", { position: 4 } );

			const tag = yield* rejectionTag( game.move( "bob", "place", { position: 4 } ) );
			assert.strictEqual( tag, "swish/InvalidMove" );
		} ) );

		it.live( "refuses a cell off the board at the schema boundary", () => Effect.gen( function* () {
			const game = yield* started( "turn-offboard" );
			const tag = yield* rejectionTag(
				game.move( "alice", "place", { position: 9 } as { position: number } )
			);

			// Bounded in `Position`, not in `validate` — so it is the input that is
			// refused, not the move.
			assert.strictEqual( tag, "swish/MoveNotAllowed" );
		} ) );

		it.live( "leaves the board untouched when a move is refused", () => Effect.gen( function* () {
			const game = yield* started( "turn-refused-noop" );
			const before = yield* game.view();

			yield* rejectionTag( game.move( "bob", "place", { position: 0 } ) );

			const after = yield* game.view();
			assert.strictEqual( after.version, before.version );
			assert.deepStrictEqual( [ ...after.view.board ], [ ...before.view.board ] );
		} ) );
	} );

	describe( "completion", () => {

		it.live( "completes on a line and names the winner", () => Effect.gen( function* () {
			const game = yield* started( "end-win" );

			// X: 0, 1, 2 — O answers in the middle row and is a move behind.
			yield* game.move( "alice", "place", { position: 0 } );
			yield* game.move( "bob", "place", { position: 3 } );
			yield* game.move( "alice", "place", { position: 1 } );
			yield* game.move( "bob", "place", { position: 4 } );
			yield* game.move( "alice", "place", { position: 2 } );

			const view = yield* game.view();
			assert.strictEqual( view.status, "COMPLETED" );
			assert.strictEqual( view.results?.winner, "alice" );
			assert.strictEqual(
				view.results?.ranking.find( entry => entry.playerId === "bob" )?.rank,
				2
			);
		} ) );

		it.live( "completes a full board as a draw", () => Effect.gen( function* () {
			const game = yield* started( "end-draw" );

			// X O X / X O O / O X X — nine moves, no line.
			const order = [ 0, 1, 2, 4, 3, 5, 7, 6, 8 ];
			for ( const [ index, position ] of order.entries() ) {
				yield* game.move( index % 2 === 0 ? "alice" : "bob", "place", { position } );
			}

			const view = yield* game.view();
			assert.strictEqual( view.status, "COMPLETED" );
			assert.isUndefined( view.results?.winner );
			assert.deepStrictEqual( view.results?.ranking.map( entry => entry.rank ), [ 1, 1 ] );
		} ) );

		it.live( "refuses a move once the game is over", () => Effect.gen( function* () {
			const game = yield* started( "end-closed" );

			yield* game.move( "alice", "place", { position: 0 } );
			yield* game.move( "bob", "place", { position: 3 } );
			yield* game.move( "alice", "place", { position: 1 } );
			yield* game.move( "bob", "place", { position: 4 } );
			yield* game.move( "alice", "place", { position: 2 } );

			const tag = yield* rejectionTag( game.move( "bob", "place", { position: 5 } ) );
			assert.strictEqual( tag, "swish/GameNotInProgress" );
		} ) );

		it.live( "archives the finished game out of the hot store", () => Effect.gen( function* () {
			const game = yield* started( "end-archive" );

			yield* game.move( "alice", "place", { position: 0 } );
			yield* game.move( "bob", "place", { position: 3 } );
			yield* game.move( "alice", "place", { position: 1 } );
			yield* game.move( "bob", "place", { position: 4 } );
			yield* game.move( "alice", "place", { position: 2 } );

			// The log only reaches Postgres on completion, and only then.
			const commits = game.ledger.of( "insert", "game_commits" );
			assert.strictEqual( commits.length, 1 );

			const rows = commits[ 0 ]?.values as ReadonlyArray<{ command: string }>;
			assert.deepStrictEqual(
				rows.map( row => row.command ),
				[ "join", "join", "start", "move", "move", "move", "move", "move" ]
			);

			const statuses = game.ledger.of( "update", "games" )
				.map( call => ( call.values as { status?: string } ).status )
				.filter( status => status !== undefined );

			assert.deepStrictEqual( statuses, [ "PLAYERS_READY", "IN_PROGRESS", "COMPLETED" ] );

			// The seats are stamped with how they finished, in the same pass.
			const stamped = game.ledger.of( "update", "game_players" )
				.map( call => call.values as { isWinner?: boolean } )
				.filter( values => values.isWinner !== undefined );

			assert.strictEqual( stamped.length, 2 );
			assert.strictEqual( stamped.filter( values => values.isWinner ).length, 1 );

			// The document is dropped from the hot store, but the entity is still
			// resident and still answers from memory — the view survives until it
			// passivates, and only the archive outlives that.
			const view = yield* game.view();
			assert.strictEqual( view.status, "COMPLETED" );
		} ) );
	} );

	describe( "undo and redo", () => {

		it.live( "takes back your own last move", () => Effect.gen( function* () {
			const game = yield* started( "undo-own" );
			yield* game.move( "alice", "place", { position: 4 } );

			yield* game.undo( "alice" );

			const view = yield* game.view();
			assert.isNull( view.view.board[ 4 ] );
			assert.strictEqual( view.context.currentPlayer, "alice" );
		} ) );

		it.live( "refuses to take back somebody else's move", () => Effect.gen( function* () {
			const game = yield* started( "undo-theirs" );
			yield* game.move( "alice", "place", { position: 4 } );

			const tag = yield* rejectionTag( game.undo( "bob" ) );
			assert.strictEqual( tag, "swish/UndoNotAllowed" );
		} ) );

		it.live( "has nothing to take back before the first move", () => Effect.gen( function* () {
			const game = yield* started( "undo-nothing" );
			const tag = yield* rejectionTag( game.undo( "alice" ) );

			// The commit at the cursor is `start`, and only a move is undoable.
			assert.strictEqual( tag, "swish/NothingToUndo" );
		} ) );

		it.live( "puts the move back on redo", () => Effect.gen( function* () {
			const game = yield* started( "redo-own" );
			yield* game.move( "alice", "place", { position: 4 } );
			yield* game.undo( "alice" );
			yield* game.redo( "alice" );

			const view = yield* game.view();
			assert.strictEqual( view.view.board[ 4 ], "X" );
			assert.strictEqual( view.context.currentPlayer, "bob" );
		} ) );

		it.live(
			"moves the version forward even when the cursor goes back",
			() => Effect.gen( function* () {
				const game = yield* started( "undo-version" );
				yield* game.move( "alice", "place", { position: 4 } );

				const played = yield* game.view();
				yield* game.undo( "alice" );
				const undone = yield* game.view();

				assert.isAbove( undone.version, played.version );
			} )
		);

		it.live( "drops the redo tail once a different move is played", () => Effect.gen( function* () {
			const game = yield* started( "redo-truncated" );
			yield* game.move( "alice", "place", { position: 4 } );
			yield* game.undo( "alice" );
			yield* game.move( "alice", "place", { position: 0 } );

			const tag = yield* rejectionTag( game.redo( "alice" ) );
			assert.strictEqual( tag, "swish/NothingToRedo" );

			const view = yield* game.view();
			assert.strictEqual( view.view.board[ 0 ], "X" );
			assert.isNull( view.view.board[ 4 ] );
		} ) );
	} );

	describe( "rematch", () => {

		/** X wins on the top row; O is a move behind throughout. */
		const decided = ( name: string ) => Effect.gen( function* () {
			const game = yield* started( name );

			yield* game.move( "alice", "place", { position: 0 } );
			yield* game.move( "bob", "place", { position: 3 } );
			yield* game.move( "alice", "place", { position: 1 } );
			yield* game.move( "bob", "place", { position: 4 } );
			yield* game.move( "alice", "place", { position: 2 } );

			return game;
		} );

		it.live( "plays the same two people again, on a clean board", () => Effect.gen( function* () {
			const game = yield* decided( "rematch-board" );
			const next = yield* game.rematch( "alice" );
			const table = game.follow( next );

			const view = yield* table.view();
			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.deepStrictEqual( [ ...view.context.players ], [ "alice", "bob" ] );
			assert.deepStrictEqual( [ ...view.view.board ], Array.from( { length: 9 }, () => null ) );
			assert.isUndefined( view.results );
		} ) );

		it.live( "deals the marks out again rather than carrying them", () => Effect.gen( function* () {
			// `onJoin` runs for every seat of the new table, so X and O are assigned
			// by the order they are seated — which is the order they sat before.
			const game = yield* decided( "rematch-marks" );
			const before = yield* game.view();
			const next = yield* game.rematch( "bob" );

			const view = yield* game.follow( next ).view();
			assert.deepStrictEqual( view.view.symbols, before.view.symbols );
		} ) );

		it.live( "is playable, and can be won again", () => Effect.gen( function* () {
			const game = yield* decided( "rematch-playable" );
			const table = game.follow( yield* game.rematch( "alice" ) );

			yield* table.move( "alice", "place", { position: 0 } );
			yield* table.move( "bob", "place", { position: 3 } );
			yield* table.move( "alice", "place", { position: 1 } );
			yield* table.move( "bob", "place", { position: 4 } );
			yield* table.move( "alice", "place", { position: 2 } );

			const view = yield* table.view();
			assert.strictEqual( view.status, "COMPLETED" );
			assert.strictEqual( view.results?.winner, "alice" );
		} ) );

		it.live( "refuses one while the game is still on", () => Effect.gen( function* () {
			const game = yield* started( "rematch-early" );
			assert.strictEqual(
				yield* rejectionTag( game.rematch( "alice" ) ),
				"swish/RematchUnavailable"
			);
		} ) );
	} );

	describe( "spectators", () => {

		it.live(
			"lets a stranger watch, and shows them the table's view",
			() => Effect.gen( function* () {
				const game = yield* started( "spectate-watch" );
				const watcher = { id: "watcher", name: "Watcher", avatar: "avatar://watcher" };

				yield* game.spectate( watcher );
				yield* game.move( "alice", "place", { position: 4 } );

				const seen = yield* game.engine.getView( game.ref )( watcher );
				assert.strictEqual( seen.view.board[ 4 ], "X" );
				assert.isUndefined( seen.view.playerId );
			} )
		);

		it.live( "refuses to seat a player as audience", () => Effect.gen( function* () {
			const game = yield* started( "spectate-player" );
			const tag = yield* rejectionTag( game.spectate( game.roster[ 0 ]! ) );
			assert.strictEqual( tag, "swish/AlreadyJoined" );
		} ) );
	} );

	describe( "the clock", () => {

		it.live(
			"hands an expired seat to the bot policy, and the bot plays it",
			() => Effect.gen( function* () {
				const game = yield* started(
					"clock-handover",
					{ botDelayMillis: 20, moveTimeoutMillis: 30 }
				);

				// Nobody moves. Alice's clock runs out, the seat is handed to `botMove`,
				// and from then on it is played for her.
				const view = yield* game.waitUntil(
					got => got.view.board.some( cell => cell !== null ),
					Duration.seconds( 5 )
				);

				// The seat was not skipped — it was handed to the policy and kept there.
				assert.isTrue( HashSet.has( view.runtime.autoPlay, seats.alice.id ) );
				assert.isAtLeast( view.view.board.filter( cell => cell !== null ).length, 1 );
			} )
		);

		it.live( "plays a bot-only table through to a finish", () => Effect.gen( function* () {
			const game = yield* makeTable( TicTacToe, {
				seats: 2,
				name: "clock-bots",
				config: { botDelayMillis: 5, moveTimeoutMillis: 20 }
			} );

			yield* game.addBots();

			// Two perfect players; the board fills and nobody wins.
			const view = yield* game.waitUntil(
				got => got.status === "COMPLETED",
				Duration.seconds( 10 )
			);

			assert.isUndefined( view.results?.winner );
			assert.deepStrictEqual( view.results?.ranking.map( entry => entry.rank ), [ 1, 1 ] );
		} ) );

		it.live( "takes the seat back when the player asks for it", () => Effect.gen( function* () {
			const game = yield* started( "clock-reclaim", { botDelayMillis: 3_600_000 } );

			yield* game.autoPlay( "alice", true );
			let view = yield* game.view();
			assert.isTrue( HashSet.has( view.runtime.autoPlay, seats.alice.id ) );

			yield* game.autoPlay( "alice", false );
			view = yield* game.view();
			assert.isFalse( HashSet.has( view.runtime.autoPlay, seats.alice.id ) );
		} ) );
	} );
} );
