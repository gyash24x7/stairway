import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import { makeTable, rejectionTag } from "@tests/harness/table";
import { seats } from "@tests/harness/users";
import { FlatEngine, FlatEngineLive, FlatStructure } from "@tests/swish/games/flat";
import {
	TEAMED_TEAMS,
	TeamedEngine,
	TeamedEngineLive,
	TeamedStructure
} from "@tests/swish/games/teamed";


const Flat = { Engine: FlatEngine, EngineLive: FlatEngineLive, Structure: FlatStructure };
const Teamed = {
	Engine: TeamedEngine,
	EngineLive: TeamedEngineLive,
	Structure: TeamedStructure
};

const alice = seats.alice.id;
const bob = seats.bob.id;

const DUEL = [ seats.alice, seats.bob ];
const FOUR = [ seats.alice, seats.bob, seats.carol, seats.dave ];

const SIDE_A = TEAMED_TEAMS[ 0 ]!;
const SIDE_B = TEAMED_TEAMS[ 1 ]!;

/** A flat duel played to a finish. */
const finished = ( name: string ) => Effect.gen( function* () {
	const game = yield* makeTable( Flat, {
		players: DUEL,
		name,
		config: { playerCount: 2, allowBonus: true, target: 10 }
	} );

	yield* game.joinAll();
	yield* game.move( "alice", "score", { points: 10 } );

	assert.strictEqual( ( yield* game.view() ).status, "COMPLETED" );
	return game;
} );

/** A four-handed team game played to a finish, sides picked deliberately. */
const finishedTeams = ( name: string ) => Effect.gen( function* () {
	const game = yield* makeTable( Teamed, {
		players: FOUR,
		name,
		config: { playerCount: 4, teams: TEAMED_TEAMS, scoring: true }
	} );

	yield* game.joinAll();
	yield* game.joinTeam( "alice", SIDE_B );
	yield* game.joinTeam( "bob", SIDE_B );
	yield* game.nameTeam( "alice", SIDE_B, "The Herons" );
	yield* game.start();

	const closer = ( yield* game.view() ).context.currentPlayer!;
	yield* game.move( closer, "end", {} );

	assert.strictEqual( ( yield* game.view() ).status, "COMPLETED" );
	return game;
} );


describe( "swish engine: rematch", () => {

	describe( "who may ask, and when", () => {

		it.live( "refuses while the game is still being played", () => Effect.gen( function* () {
			const game = yield* makeTable( Flat, {
				players: DUEL,
				name: "rematch-running",
				config: { playerCount: 2, allowBonus: true, target: 10 }
			} );

			yield* game.joinAll();

			assert.strictEqual(
				yield* rejectionTag( game.rematch( "alice" ) ),
				"swish/RematchUnavailable"
			);
		} ) );

		it.live( "refuses before the table has even filled", () => Effect.gen( function* () {
			const game = yield* makeTable( Flat, {
				players: DUEL,
				name: "rematch-lobby",
				config: { playerCount: 2, allowBonus: true, target: 10 }
			} );

			assert.strictEqual(
				yield* rejectionTag( game.rematch( "alice" ) ),
				"swish/RematchUnavailable"
			);
		} ) );

		it.live( "refuses somebody who never sat here", () => Effect.gen( function* () {
			const game = yield* finished( "rematch-stranger" );
			const outsider = { id: "mallory", name: "M", avatar: "m" };

			const tag = yield* rejectionTag(
				game.run( game.engine.rematch( game.ref, {
					_tag: "swish/RematchInput",
					keepTeams: false
				} )( outsider ) )
			);

			assert.strictEqual( tag, "swish/NotAMember" );
		} ) );
	} );

	describe( "the table it makes", () => {

		it.live( "is a different game, ready to play", () => Effect.gen( function* () {
			const game = yield* finished( "rematch-fresh" );
			const next = yield* game.rematch( "alice" );

			assert.notStrictEqual( next.gameId, game.id );

			const view = yield* game.follow( next ).view();
			assert.strictEqual( view.status, "IN_PROGRESS" );
			assert.strictEqual( view.version > 0, true );

			// A fresh position, not the finished one carried over.
			assert.deepStrictEqual( [ ...view.view.log ], [] );
			assert.deepStrictEqual( view.view.scores, {} );
			assert.isUndefined( view.results );
		} ) );

		it.live(
			"seats everybody who sat at the last one, in the same order",
			() => Effect.gen( function* () {
				const game = yield* finished( "rematch-roster" );
				const before = yield* game.view();
				const next = yield* game.rematch( "alice" );

				const view = yield* game.follow( next ).view();
				assert.deepStrictEqual( [ ...view.context.players ], [ ...before.context.players ] );
				assert.deepStrictEqual(
					Object.keys( view.players ).sort(),
					Object.keys( before.players ).sort()
				);
			} )
		);

		it.live( "carries the bots across as seats, not as holes", () => Effect.gen( function* () {
			const game = yield* makeTable( Flat, {
				players: DUEL,
				name: "rematch-bots",
				config: { playerCount: 2, allowBonus: true, target: 10, botDelayMillis: 3_600_000 }
			} );

			yield* game.addBots();
			yield* game.move( "alice", "score", { points: 10 } );

			const next = yield* game.rematch( "alice" );
			const view = yield* game.follow( next ).view();

			assert.strictEqual( view.context.players.length, 2 );
			assert.strictEqual(
				Object.values( view.players ).filter( player => player.isBot === true ).length,
				1
			);
		} ) );

		it.live( "plays the same rules", () => Effect.gen( function* () {
			const game = yield* finished( "rematch-config" );
			const before = yield* game.view();
			const next = yield* game.rematch( "alice" );

			const view = yield* game.follow( next ).view();
			assert.deepStrictEqual( view.config, before.config );
		} ) );

		it.live( "can be played", () => Effect.gen( function* () {
			const game = yield* finished( "rematch-playable" );
			const next = yield* game.rematch( "alice" );
			const table = game.follow( next );

			yield* table.move( "alice", "score", { points: 4 } );

			const view = yield* table.view();
			assert.strictEqual( view.view.scores[ alice ], 4 );
			assert.strictEqual( view.context.currentPlayer, bob );
		} ) );

		it.live( "records which game it came from", () => Effect.gen( function* () {
			const game = yield* finished( "rematch-archive" );
			const next = yield* game.rematch( "alice" );

			const created = game.ledger.of( "insert", "games" )
				.map( call => call.values as { id: string; rematchOf?: string } );

			assert.strictEqual( created.length, 2, "two tables were opened" );
			assert.isUndefined( created[ 0 ]?.rematchOf, "the first came from nowhere" );
			assert.strictEqual( created[ 1 ]?.rematchOf, game.id );
			assert.strictEqual( created[ 1 ]?.id, next.gameId );
		} ) );

		it.live( "keeps itself off the lobby", () => Effect.gen( function* () {
			// It is full the moment it exists, so there is no seat to offer.
			const game = yield* finished( "rematch-private" );
			yield* game.rematch( "alice" );

			const created = game.ledger.of( "insert", "games" )
				.map( call => call.values as { isPrivate: boolean } );

			assert.isTrue( created[ 1 ]?.isPrivate );
		} ) );
	} );

	describe( "there is only one", () => {

		it.live( "answers a second ask with the one that exists", () => Effect.gen( function* () {
			const game = yield* finished( "rematch-once" );

			const first = yield* game.rematch( "alice" );
			const second = yield* game.rematch( "bob" );

			assert.strictEqual( second.gameId, first.gameId );
			assert.strictEqual( game.ledger.of( "insert", "games" ).length, 2 );
		} ) );

		it.live( "answers everybody at the table with the same one", () => Effect.gen( function* () {
			const game = yield* finished( "rematch-everybody" );

			const refs = yield* Effect.all( [
				game.rematch( "alice" ),
				game.rematch( "bob" ),
				game.rematch( "alice" )
			] );

			assert.strictEqual( new Set( refs.map( ref => ref.gameId ) ).size, 1 );
		} ) );

		it.live(
			"publishes it on the finished game, for the clients still watching",
			() => Effect.gen( function* () {
				const game = yield* finished( "rematch-published" );

				assert.isUndefined( ( yield* game.view() ).runtime.rematch );

				const next = yield* game.rematch( "alice" );
				const view = yield* game.view();

				assert.strictEqual( view.runtime.rematch?.gameId, next.gameId );

				// A pointer, not a move: the log did not grow.
				assert.strictEqual( view.status, "COMPLETED" );
			} )
		);
	} );

	describe( "sides", () => {

		it.live( "carries them over when asked to", () => Effect.gen( function* () {
			const game = yield* finishedTeams( "rematch-keep" );
			const before = yield* game.view();
			const next = yield* game.rematch( "alice", true );

			const view = yield* game.follow( next ).view();

			// The config comes across whole, `autoStart` included — so a game that
			// waited to be started waits again, with its sides already picked.
			assert.strictEqual( view.status, "PLAYERS_READY" );
			for ( const seat of view.context.players ) {
				assert.strictEqual(
					view.context.teams[ seat ],
					before.context.teams[ seat ],
					seat
				);
			}
		} ) );

		it.live( "carries what the sides called themselves", () => Effect.gen( function* () {
			const game = yield* finishedTeams( "rematch-names" );
			const next = yield* game.rematch( "alice", true );

			const view = yield* game.follow( next ).view();
			assert.strictEqual( view.context.teamNames[ SIDE_B ], "The Herons" );
		} ) );

		it.live( "gives a side that never named itself its own id", () => Effect.gen( function* () {
			const game = yield* finishedTeams( "rematch-unnamed" );
			const next = yield* game.rematch( "alice", true );

			const view = yield* game.follow( next ).view();
			assert.strictEqual( view.context.teamNames[ SIDE_A ], SIDE_A );
		} ) );

		it.live(
			"leaves every seat unassigned when asked not to keep them",
			() => Effect.gen( function* () {
				const game = yield* finishedTeams( "rematch-drop" );
				const next = yield* game.rematch( "alice", false );
				const table = game.follow( next );

				const waiting = yield* table.view();
				assert.deepStrictEqual( waiting.context.teams, {}, "nobody is placed" );
				assert.deepStrictEqual( waiting.context.teamNames, {}, "and nothing is named" );

				// Which leaves the table exactly as one whose players never picked:
				// `start` balances it.
				yield* table.start();

				const started = yield* table.view();
				assert.strictEqual( Object.keys( started.context.teams ).length, 4 );
			} )
		);

		it.live(
			"seats the sides interleaved, as any team game starts",
			() => Effect.gen( function* () {
				const game = yield* finishedTeams( "rematch-interleaved" );
				const next = yield* game.rematch( "alice", true );
				const table = game.follow( next );

				yield* table.start();

				const view = yield* table.view();
				const sides = view.context.players.map( seat => view.context.teams[ seat ] );

				for ( let i = 1; i < sides.length; i++ ) {
					assert.notStrictEqual( sides[ i ], sides[ i - 1 ], `seat ${ i }` );
				}
			} )
		);
	} );

	describe( "the chain", () => {

		it.live( "can itself be played again", () => Effect.gen( function* () {
			const game = yield* finished( "rematch-chain" );
			const second = yield* game.rematch( "alice" );
			const table = game.follow( second );

			yield* table.move( "alice", "score", { points: 10 } );
			assert.strictEqual( ( yield* table.view() ).status, "COMPLETED" );

			const third = yield* table.rematch( "alice" );

			assert.notStrictEqual( third.gameId, second.gameId );
			assert.notStrictEqual( third.gameId, game.id );

			const created = game.ledger.of( "insert", "games" )
				.map( call => call.values as { id: string; rematchOf?: string } );

			assert.strictEqual( created.length, 3 );
			assert.strictEqual( created[ 2 ]?.rematchOf, second.gameId );
		} ) );
	} );
} );
