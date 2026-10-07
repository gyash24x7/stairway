import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";

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

const table = ( name: string, config = {} ) => makeTable( Flat, {
	players: DUEL,
	name,
	config: { playerCount: 2, allowBonus: true, target: 10, ...config }
} );

const started = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* table( name, config );
	yield* game.joinAll();
	return game;
} );


describe( "swish engine", () => {

	describe( "the lobby", () => {

		it.live( "seats the creator and opens the table", () => Effect.gen( function* () {
			const game = yield* table( "lobby-open" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "CREATED" );
			assert.deepStrictEqual( [ ...view.context.players ], [ alice ] );
			assert.strictEqual( view.version, 1 );
		} ) );

		it.live( "refuses a seat once the table is full", () => Effect.gen( function* () {
			const game = yield* makeTable( Flat, {
				players: Object.values( makeUsers( [ "alice", "bob", "carol" ] as const ) ),
				name: "lobby-full",
				config: { playerCount: 2, allowBonus: true, target: 10 }
			} );

			yield* game.join( "bob" );
			assert.strictEqual( yield* rejectionTag( game.join( "carol" ) ), "swish/GameNotJoinable" );
		} ) );

		it.live( "refuses the same player twice", () => Effect.gen( function* () {
			const game = yield* table( "lobby-twice" );
			assert.strictEqual( yield* rejectionTag( game.join( "alice" ) ), "swish/AlreadyJoined" );
		} ) );

		it.live( "refuses a move from somebody with no seat", () => Effect.gen( function* () {
			const game = yield* started( "lobby-stranger" );
			const outsider = { id: "mallory", name: "M", avatar: "m" };

			const tag = yield* rejectionTag(
				game.run( game.engine.submitMove( "score", game.ref, { points: 1 } )( outsider ) )
			);

			assert.strictEqual( tag, "swish/NotAMember" );
		} ) );

		it.live( "starts itself when the last seat is taken", () => Effect.gen( function* () {
			const game = yield* started( "lobby-autostart" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual( view.context.currentPlayer, alice );
		} ) );

		it.live( "refuses starting a table that is not full", () => Effect.gen( function* () {
			const game = yield* table( "lobby-partial", { autoStart: false } );
			assert.strictEqual( yield* rejectionTag( game.start() ), "swish/CannotStart" );
		} ) );

		it.live( "fills the remaining seats with bots on request", () => Effect.gen( function* () {
			const game = yield* table( "lobby-bots" );
			yield* game.addBots();

			const view = yield* game.view();
			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual(
				Object.values( view.players ).filter( player => player.isBot === true ).length,
				1
			);
		} ) );
	} );

	describe( "spectating", () => {

		const watcher = { id: "watcher", name: "Watcher", avatar: "avatar://watcher" };

		it.live(
			"lets a stranger watch, and shows them the table's view",
			() => Effect.gen( function* () {
				const game = yield* started( "spectate-watch" );
				yield* game.spectate( watcher );

				const seen = yield* game.engine.getView( game.ref )( watcher );
				assert.isUndefined( seen.view.playerId );
				assert.strictEqual( Object.keys( seen.runtime.spectators ).length, 1 );
			} )
		);

		it.live( "refuses to seat a player as audience", () => Effect.gen( function* () {
			const game = yield* started( "spectate-player" );
			assert.strictEqual(
				yield* rejectionTag( game.spectate( seats.alice ) ),
				"swish/AlreadyJoined"
			);
		} ) );

		it.live( "is a no-op for somebody already watching", () => Effect.gen( function* () {
			const game = yield* started( "spectate-twice" );
			yield* game.spectate( watcher );

			const before = yield* game.view();
			yield* game.spectate( watcher );

			assert.strictEqual( ( yield* game.view() ).runtime.revision, before.runtime.revision );
		} ) );

		it.live(
			"prunes a watcher out of the very commit that seats them",
			() => Effect.gen( function* () {
				// The same name in both lists reads as two different people, so no frame
				// a client renders ever shows them twice.
				const game = yield* makeTable( Flat, {
					players: [ seats.alice, seats.bob, seats.carol ],
					name: "spectate-seated",
					config: { playerCount: 3, allowBonus: true, target: 10 }
				} );

				yield* game.spectate( seats.bob );
				assert.strictEqual( Object.keys( ( yield* game.view() ).runtime.spectators ).length, 1 );

				yield* game.join( "bob" );

				const view = yield* game.view();
				assert.deepStrictEqual( view.runtime.spectators, {} );
				assert.include( [ ...view.context.players ], bob );
			} )
		);
	} );

	describe( "the turn tail", () => {

		it.live( "advances the turn and the cursor together", () => Effect.gen( function* () {
			const game = yield* started( "turn-advance" );

			yield* game.move( "alice", "score", { points: 1 } );

			const view = yield* game.view();
			assert.strictEqual( view.context.turn, 1 );
			assert.strictEqual( view.context.currentPlayer, bob );
		} ) );

		it.live( "goes round the table by default", () => Effect.gen( function* () {
			// No `resolveNextPlayer`, so the engine's own round-robin applies.
			const game = yield* started( "turn-default-order" );

			yield* game.move( "alice", "score", { points: 1 } );
			yield* game.move( "bob", "score", { points: 1 } );

			assert.strictEqual( ( yield* game.context() ).currentPlayer, alice );
		} ) );

		it.live( "refuses a move out of turn", () => Effect.gen( function* () {
			const game = yield* started( "turn-order" );
			assert.strictEqual(
				yield* rejectionTag( game.move( "bob", "score", { points: 1 } ) ),
				"swish/NotYourTurn"
			);
		} ) );

		it.live( "refuses a move the game does not declare", () => Effect.gen( function* () {
			// The name is looked up before it is decoded against, so a name this
			// game has never heard of is a refusal rather than a defect that
			// restarts the entity and redelivers the same command.
			const game = yield* started( "turn-unknown" );
			assert.strictEqual(
				yield* rejectionTag( game.move( "alice", "nope" as "score", {} as never ) ),
				"swish/MoveNotAllowed"
			);
		} ) );

		it.live( "refuses an input that fails its own schema", () => Effect.gen( function* () {
			const game = yield* started( "turn-bad-input" );
			assert.strictEqual(
				yield* rejectionTag( game.move( "alice", "score", { points: "lots" } as never ) ),
				"swish/MoveNotAllowed"
			);
		} ) );
	} );

	describe( "enabledWhen", () => {

		it.live( "allows a move the config turns on", () => Effect.gen( function* () {
			const game = yield* started( "gate-on" );
			yield* game.move( "alice", "bonus", {} );

			assert.strictEqual( ( yield* game.state() ).scores[ alice ], 1 );
		} ) );

		it.live( "refuses it centrally when the config turns it off", () => Effect.gen( function* () {
			// Refused before `validate` is ever asked — this is the engine's gate,
			// not the game's.
			const game = yield* started( "gate-off", { allowBonus: false } );

			assert.strictEqual(
				yield* rejectionTag( game.move( "alice", "bonus", {} ) ),
				"swish/MoveNotAllowed"
			);
			assert.strictEqual( ( yield* game.state() ).prepared, 0, "and nothing was prepared" );
		} ) );
	} );

	describe( "beforeMove", () => {

		it.live( "runs ahead of the move and lands in the same commit", () => Effect.gen( function* () {
			const game = yield* started( "before-runs" );
			yield* game.move( "alice", "score", { points: 2 } );

			const state = yield* game.state();
			assert.strictEqual( state.prepared, 1 );
			assert.deepStrictEqual( [ ...state.log ], [ "prepared:score:alice", "scored:alice:2" ] );
		} ) );

		it.live(
			"throws its events away when the move turns out to be illegal",
			() => Effect.gen( function* () {
				// The commit is discarded whole, this hook's events included.
				const game = yield* started( "before-discarded" );
				const before = yield* game.view();

				assert.strictEqual(
					yield* rejectionTag( game.move( "alice", "score", { points: 0 } ) ),
					"swish/InvalidMove"
				);

				const after = yield* game.view();
				assert.strictEqual( after.version, before.version );
				assert.strictEqual( after.view.prepared, 0 );
				assert.deepStrictEqual( [ ...after.view.log ], [] );
			} )
		);

		it.live(
			"does not run for a move the turn guard already refused",
			() => Effect.gen( function* () {
				const game = yield* started( "before-not-your-turn" );
				yield* rejectionTag( game.move( "bob", "score", { points: 1 } ) );

				assert.strictEqual( ( yield* game.state() ).prepared, 0 );
			} )
		);
	} );

	describe( "endsTurn", () => {

		it.live(
			"keeps the seat when the move declines to end the turn",
			() => Effect.gen( function* () {
				const game = yield* started( "stay-keeps" );
				yield* game.move( "alice", "stay", { again: true } );

				const view = yield* game.view();
				assert.strictEqual( view.context.currentPlayer, alice );
				assert.strictEqual( view.context.turn, 0, "and the turn counter stays put" );
				assert.deepStrictEqual( [ ...view.view.log ].at( -1 ), "noted:stayed:alice" );
			} )
		);

		it.live( "lets the same move end the turn on its other branch", () => Effect.gen( function* () {
			const game = yield* started( "stay-ends" );
			yield* game.move( "alice", "stay", { again: false } );

			const view = yield* game.view();
			assert.strictEqual( view.context.currentPlayer, bob );
			assert.strictEqual( view.context.turn, 1 );
		} ) );

		it.live( "lets a seat play several times over one turn", () => Effect.gen( function* () {
			const game = yield* started( "stay-repeats" );

			yield* game.move( "alice", "stay", { again: true } );
			yield* game.move( "alice", "stay", { again: true } );
			yield* game.move( "alice", "score", { points: 1 } );

			const view = yield* game.view();
			assert.strictEqual( view.context.currentPlayer, bob );
			assert.strictEqual( view.context.turn, 1, "one turn, three moves" );
		} ) );

		it.live( "leaves the clock running from the start of the turn", () => Effect.gen( function* () {
			// The documented cost of keeping the seat: `turnStartedAt` is only
			// re-stamped when the pending seat changes, so a move that leaves the
			// seat where it was leaves both clocks counting from the turn's start.
			const game = yield* started( "stay-clock" );
			const before = yield* game.view();

			yield* game.move( "alice", "stay", { again: true } );

			const after = yield* game.view();
			assert.strictEqual( after.runtime.turnStartedAt, before.runtime.turnStartedAt );
			assert.isAbove( after.runtime.revision, before.runtime.revision, "but the write happened" );
		} ) );
	} );

	describe( "completion with no resolveResults", () => {

		it.live(
			"completes without standings when the game ranks nobody",
			() => Effect.gen( function* () {
				const game = yield* started( "end-no-results" );

				yield* game.move( "alice", "score", { points: 10 } );

				const view = yield* game.view();
				assert.strictEqual( view.status, "COMPLETED" );
				assert.isUndefined( view.results, "no ResultsResolved was ever emitted" );
			} )
		);

		it.live( "still archives the log and stamps the status", () => Effect.gen( function* () {
			const game = yield* started( "end-archive" );
			yield* game.move( "alice", "score", { points: 10 } );

			const commits = game.ledger.of( "insert", "game_commits" );
			assert.strictEqual( commits.length, 1 );

			const statuses = game.ledger.of( "update", "games" )
				.map( call => ( call.values as { status?: string } ).status )
				.filter( status => status !== undefined );

			assert.deepStrictEqual( statuses, [ "PLAYERS_READY", "IN_PROGRESS", "COMPLETED" ] );
		} ) );

		it.live( "refuses a move once the game is over", () => Effect.gen( function* () {
			const game = yield* started( "end-closed" );
			yield* game.move( "alice", "score", { points: 10 } );

			assert.strictEqual(
				yield* rejectionTag( game.move( "bob", "score", { points: 1 } ) ),
				"swish/GameNotInProgress"
			);
		} ) );
	} );

	describe( "undo and redo", () => {

		it.live( "takes back your own last move", () => Effect.gen( function* () {
			const game = yield* started( "undo-own" );
			yield* game.move( "alice", "score", { points: 3 } );
			yield* game.undo( "alice" );

			const view = yield* game.view();
			assert.isUndefined( view.view.scores[ alice ] );
			assert.strictEqual( view.context.currentPlayer, alice );
			assert.strictEqual( view.context.turn, 0 );
		} ) );

		it.live( "refuses taking back somebody else's", () => Effect.gen( function* () {
			const game = yield* started( "undo-theirs" );
			yield* game.move( "alice", "score", { points: 3 } );

			assert.strictEqual( yield* rejectionTag( game.undo( "bob" ) ), "swish/UndoNotAllowed" );
		} ) );

		it.live( "refuses an undo from somebody with no seat", () => Effect.gen( function* () {
			const game = yield* started( "undo-stranger" );
			yield* game.move( "alice", "score", { points: 3 } );

			const outsider = { id: "mallory", name: "M", avatar: "m" };
			const tag = yield* rejectionTag( game.run( game.engine.undo( game.ref )( outsider ) ) );

			assert.strictEqual( tag, "swish/NotAMember" );
		} ) );

		it.live( "has nothing to take back before the first move", () => Effect.gen( function* () {
			// The commit at the cursor is `start`, and only a move is undoable.
			const game = yield* started( "undo-nothing" );
			assert.strictEqual( yield* rejectionTag( game.undo( "alice" ) ), "swish/NothingToUndo" );
		} ) );

		it.live( "refuses an undo once the game is over", () => Effect.gen( function* () {
			const game = yield* started( "undo-completed" );
			yield* game.move( "alice", "score", { points: 10 } );

			assert.strictEqual( yield* rejectionTag( game.undo( "alice" ) ), "swish/UndoNotAllowed" );
		} ) );

		it.live( "puts the move back on redo", () => Effect.gen( function* () {
			const game = yield* started( "redo-own" );
			yield* game.move( "alice", "score", { points: 3 } );
			yield* game.undo( "alice" );
			yield* game.redo( "alice" );

			const view = yield* game.view();
			assert.strictEqual( view.view.scores[ alice ], 3 );
			assert.strictEqual( view.context.currentPlayer, bob );
		} ) );

		it.live( "refuses redoing somebody else's move", () => Effect.gen( function* () {
			const game = yield* started( "redo-theirs" );
			yield* game.move( "alice", "score", { points: 3 } );
			yield* game.undo( "alice" );

			assert.strictEqual( yield* rejectionTag( game.redo( "bob" ) ), "swish/RedoNotAllowed" );
		} ) );

		it.live( "has nothing to redo at the head of the log", () => Effect.gen( function* () {
			const game = yield* started( "redo-nothing" );
			assert.strictEqual( yield* rejectionTag( game.redo( "alice" ) ), "swish/NothingToRedo" );
		} ) );

		it.live(
			"moves the version forward even as the cursor goes back",
			() => Effect.gen( function* () {
				// It counts every mutation including the undos, so a client that cached
				// the old number does not discard the new record as stale.
				const game = yield* started( "undo-version" );
				yield* game.move( "alice", "score", { points: 3 } );

				const played = yield* game.view();
				yield* game.undo( "alice" );
				const undone = yield* game.view();
				yield* game.redo( "alice" );
				const redone = yield* game.view();

				assert.isAbove( undone.version, played.version );
				assert.isAbove( redone.version, undone.version );
			} )
		);

		it.live( "drops the redo tail once a different move is played", () => Effect.gen( function* () {
			const game = yield* started( "redo-truncated" );
			yield* game.move( "alice", "score", { points: 3 } );
			yield* game.undo( "alice" );
			yield* game.move( "alice", "score", { points: 5 } );

			assert.strictEqual( yield* rejectionTag( game.redo( "alice" ) ), "swish/NothingToRedo" );
			assert.strictEqual( ( yield* game.state() ).scores[ alice ], 5 );
		} ) );

		it.live( "rebuilds the record by re-folding, not by inverting", () => Effect.gen( function* () {
			// There are no inverse events — an immer reducer cannot run backwards —
			// so stepping the cursor back and folding from genesis *is* the undo.
			const game = yield* started( "undo-refold" );

			yield* game.move( "alice", "score", { points: 2 } );
			yield* game.move( "bob", "score", { points: 4 } );
			yield* game.undo( "bob" );

			const state = yield* game.state();
			assert.deepStrictEqual( [ ...state.log ], [ "prepared:score:alice", "scored:alice:2" ] );
			assert.strictEqual( state.prepared, 1 );
		} ) );
	} );

	describe( "autoPlay", () => {

		it.live( "hands a seat over and takes it back", () => Effect.gen( function* () {
			const game = yield* started( "auto-toggle", { botDelayMillis: 3_600_000 } );

			yield* game.autoPlay( "alice", true );
			assert.isTrue( HashSet.has( ( yield* game.view() ).runtime.autoPlay, alice ) );

			yield* game.autoPlay( "alice", false );
			assert.isFalse( HashSet.has( ( yield* game.view() ).runtime.autoPlay, alice ) );
		} ) );

		it.live( "bumps the revision without committing anything", () => Effect.gen( function* () {
			// Which is why a client dedupes on `revision` rather than on `version`.
			const game = yield* started( "auto-revision" );
			const before = yield* game.view();

			yield* game.autoPlay( "alice", true );

			const after = yield* game.view();
			assert.strictEqual( after.version, before.version );
			assert.isAbove( after.runtime.revision, before.runtime.revision );
		} ) );

		it.live(
			"allows it for a game whose only policy answers windows",
			() => Effect.gen( function* () {
				// `askingtest` takes no turns of its own but does answer windows, and
				// being answered for while a window holds the table up is most of what
				// handing a seat over is for.
				const game = yield* makeTable( Asking, {
					players: DUEL,
					name: "auto-respond-only",
					config: { playerCount: 2, chainDepth: 3 }
				} );

				yield* game.joinAll();
				yield* game.autoPlay( "alice", true );

				assert.isTrue( HashSet.has( ( yield* game.view() ).runtime.autoPlay, alice ) );
			} )
		);

		it.live( "refuses it for a game with no bot policy at all", () => Effect.gen( function* () {
			// `phasedtest` declares no `botMove`, so there is nothing to hand a seat
			// to and the engine says so rather than parking the turn.
			const game = yield* makeTable( Phased, {
				players: DUEL,
				name: "auto-unavailable",
				config: { playerCount: 2, rounds: 1 }
			} );

			yield* game.joinAll();

			assert.strictEqual(
				yield* rejectionTag( game.autoPlay( "alice", true ) ),
				"swish/AutoPlayUnavailable"
			);
		} ) );
	} );

	describe( "the clock", () => {

		it.live( "keeps none at all for a game with no bot policy", () => Effect.gen( function* () {
			// A timeout's only outcome is to hand the seat to the very policy that
			// clock governs, so a game without one keeps no clock rather than taking
			// a seat away with nothing to play it.
			const game = yield* makeTable( Phased, {
				players: DUEL,
				name: "clock-none",
				config: { playerCount: 2, rounds: 1, moveTimeoutMillis: 20, botDelayMillis: 20 }
			} );

			yield* game.joinAll();

			assert.isUndefined( ( yield* game.view() ).runtime.deadline );

			// Nothing fires, however long it is left.
			yield* Effect.sleep( Duration.millis( 150 ) );
			assert.strictEqual( ( yield* game.view() ).context.currentPlayer, alice );
		} ) );

		it.live(
			"hands an expired seat to the policy where there is one",
			() => Effect.gen( function* () {
				const game = yield* started(
					"clock-handover",
					{ botDelayMillis: 10, moveTimeoutMillis: 20 }
				);

				// Nobody moves; alice's clock runs out and the seat is played for her.
				const view = yield* game.waitUntil(
					got => Object.keys( got.view.scores ).length > 0,
					Duration.seconds( 5 )
				);

				assert.isTrue( HashSet.has( view.runtime.autoPlay, alice ) );
			} )
		);

		it.live( "stamps the turn as the pending seat changes", () => Effect.gen( function* () {
			const game = yield* started( "clock-stamp" );
			const before = yield* game.view();

			yield* game.move( "alice", "score", { points: 1 } );

			assert.isAbove(
				( yield* game.view() ).runtime.turnStartedAt!,
				before.runtime.turnStartedAt! - 1
			);
		} ) );
	} );

	describe( "views and subscriptions", () => {

		it.live(
			"serves a seat its own view and the table the redacted one",
			() => Effect.gen( function* () {
				const game = yield* started( "view-audience" );

				const mine = yield* game.state( "alice" );
				const table = yield* game.state();

				assert.strictEqual( mine.playerId, alice );
				assert.isUndefined( table.playerId );
			} )
		);

		it.live( "pushes on every write, not only on every commit", () => Effect.gen( function* () {
			// `autoPlay` bumps the revision without committing, and a client that
			// deduped on `version` would never see the seat change hands.
			const game = yield* started( "view-revision" );

			const first = yield* game.view();
			yield* game.move( "alice", "score", { points: 1 } );
			const second = yield* game.view();

			assert.isAbove( second.runtime.revision, first.runtime.revision );
			assert.isAbove( second.version, first.version );
		} ) );

		it.live( "carries the whole context across the wire", () => Effect.gen( function* () {
			const game = yield* started( "view-context" );
			const view = yield* game.view();

			assert.deepStrictEqual( [ ...view.context.players ], [ alice, bob ] );
			assert.strictEqual( view.context.currentPlayer, alice );
			assert.deepStrictEqual( [ ...view.context.interactions ], [] );
		} ) );
	} );
} );
