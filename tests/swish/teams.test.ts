import * as Effect from "effect/Effect";

import { assert, describe, it } from "@effect/vitest";

import { makeTable, rejectionTag } from "@tests/harness/table";
import { seats } from "@tests/harness/users";
import {
	TEAMED_TEAMS,
	TeamedEngine,
	TeamedEngineLive,
	TeamedStructure
} from "@tests/swish/games/teamed";


const Teamed = {
	Engine: TeamedEngine,
	EngineLive: TeamedEngineLive,
	Structure: TeamedStructure
};

const alice = seats.alice.id;
const bob = seats.bob.id;
const carol = seats.carol.id;
const dave = seats.dave.id;

const SIDE_A = TEAMED_TEAMS[ 0 ]!;
const SIDE_B = TEAMED_TEAMS[ 1 ]!;

const TABLE = [ seats.alice, seats.bob, seats.carol, seats.dave ];

const seated = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* makeTable( Teamed, {
		players: TABLE,
		name,
		config: { playerCount: 4, teams: TEAMED_TEAMS, scoring: true, ...config }
	} );

	yield* game.joinAll();
	return game;
} );

const started = ( name: string, config = {} ) => Effect.gen( function* () {
	const game = yield* seated( name, config );
	yield* game.start();
	return game;
} );

describe( "swish engine: teams", () => {

	describe( "the lobby", () => {

		it.live( "starts with nobody on a side", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-open" );
			const view = yield* game.view();

			assert.strictEqual( view.status, "PLAYERS_READY" );
			assert.deepStrictEqual( view.context.teams, {} );
		} ) );

		it.live( "lets a player pick a side", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-pick" );
			yield* game.joinTeam( "alice", SIDE_A );

			assert.strictEqual( ( yield* game.view() ).context.teams[ alice ], SIDE_A );
		} ) );

		it.live( "refuses a side the table does not declare", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-unknown" );
			assert.strictEqual(
				yield* rejectionTag( game.joinTeam( "alice", "SIDE_Z" ) ),
				"swish/TeamNotFound"
			);
		} ) );

		it.live( "refuses a side already at its share of the seats", () => Effect.gen( function* () {
			// Sides are equal-sized: four seats over two sides is two each.
			const game = yield* seated( "lobby-full" );

			yield* game.joinTeam( "alice", SIDE_A );
			yield* game.joinTeam( "bob", SIDE_A );

			assert.strictEqual(
				yield* rejectionTag( game.joinTeam( "carol", SIDE_A ) ),
				"swish/TeamFull"
			);
		} ) );

		it.live( "moves a player from one side to the other", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-switch" );

			yield* game.joinTeam( "alice", SIDE_A );
			yield* game.joinTeam( "alice", SIDE_B );

			assert.strictEqual( ( yield* game.view() ).context.teams[ alice ], SIDE_B );
		} ) );

		it.live( "treats re-joining the same side as a no-op", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-rejoin" );
			yield* game.joinTeam( "alice", SIDE_A );

			const before = yield* game.view();
			yield* game.joinTeam( "alice", SIDE_A );

			assert.strictEqual( ( yield* game.view() ).version, before.version );
		} ) );

		it.live(
			"lets a player leave, and treats leaving nothing as a no-op",
			() => Effect.gen( function* () {
				const game = yield* seated( "lobby-leave" );

				const untouched = yield* game.view();
				yield* game.leaveTeam( "alice" );
				assert.strictEqual( ( yield* game.view() ).version, untouched.version );

				yield* game.joinTeam( "alice", SIDE_A );
				yield* game.leaveTeam( "alice" );

				assert.isUndefined( ( yield* game.view() ).context.teams[ alice ] );
			} )
		);

		it.live( "names a side once, and only from inside it", () => Effect.gen( function* () {
			const game = yield* seated( "lobby-name" );
			yield* game.joinTeam( "alice", SIDE_A );

			assert.strictEqual(
				yield* rejectionTag( game.nameTeam( "bob", SIDE_A, "Ours" ) ),
				"swish/NotOnTeam"
			);

			yield* game.nameTeam( "alice", SIDE_A, "The Herons" );
			assert.strictEqual( ( yield* game.view() ).context.teamNames[ SIDE_A ], "The Herons" );

			assert.strictEqual(
				yield* rejectionTag( game.nameTeam( "alice", SIDE_A, "Something Else" ) ),
				"swish/TeamAlreadyNamed"
			);
		} ) );
	} );

	describe( "starting", () => {

		it.live( "balances whoever picked nothing", () => Effect.gen( function* () {
			const game = yield* started( "start-balance" );
			const view = yield* game.view();

			const sides = view.context.players.map( seat => view.context.teams[ seat ] );
			assert.strictEqual( sides.filter( side => side === SIDE_A ).length, 2 );
			assert.strictEqual( sides.filter( side => side === SIDE_B ).length, 2 );
		} ) );

		it.live( "honours a side somebody already picked", () => Effect.gen( function* () {
			const game = yield* seated( "start-honours" );
			yield* game.joinTeam( "alice", SIDE_B );
			yield* game.joinTeam( "bob", SIDE_B );
			yield* game.start();

			const view = yield* game.view();
			assert.strictEqual( view.context.teams[ alice ], SIDE_B );
			assert.strictEqual( view.context.teams[ bob ], SIDE_B );
			assert.strictEqual( view.context.teams[ carol ], SIDE_A );
			assert.strictEqual( view.context.teams[ dave ], SIDE_A );
		} ) );

		it.live(
			"interleaves the seats so round-robin alternates sides",
			() => Effect.gen( function* () {
				const game = yield* started( "start-interleave" );
				const view = yield* game.view();

				const sides = view.context.players.map( seat => view.context.teams[ seat ] );
				for ( let i = 1; i < sides.length; i++ ) {
					assert.notStrictEqual( sides[ i ], sides[ i - 1 ], `seat ${ i }` );
				}
			} )
		);

		it.live( "keeps the roster whole through the re-seating", () => Effect.gen( function* () {
			const game = yield* started( "start-roster" );
			const view = yield* game.view();

			assert.deepStrictEqual(
				[ ...view.context.players ].sort(),
				[ alice, bob, carol, dave ].sort()
			);
		} ) );
	} );

	describe( "a bad team config", () => {

		it.live( "refuses seats that do not split evenly", () => Effect.gen( function* () {
			const tag = yield* rejectionTag( Effect.gen( function* () {
				const game = yield* makeTable( Teamed, {
					players: TABLE.slice( 0, 3 ),
					name: "config-uneven",
					config: { playerCount: 3, teams: TEAMED_TEAMS, scoring: true }
				} );

				return yield* game.view();
			} ) );

			// `initialize` refuses the config outright, so the table never exists.
			assert.oneOf( tag, [ "swish/InvalidTeamConfig", "swish/GameNotFound" ] );
		} ) );
	} );

	describe( "standings the engine compiles", () => {

		/** Ends the game with the points spread as named. */
		const finishedWith = ( name: string, points: Record<string, number>, scoring = true ) =>
			Effect.gen( function* () {
				const game = yield* started( name, { scoring } );

				// Play round-robin, each seat banking what it was given.
				for ( const _round of [ 0 ] ) {
					for ( let i = 0; i < TABLE.length; i++ ) {
						const seat = ( yield* game.view() ).context.currentPlayer!;
						yield* game.move( seat, "gain", { points: points[ seat ] ?? 0 } );
					}
				}

				const closer = ( yield* game.view() ).context.currentPlayer!;
				yield* game.move( closer, "end", {} );

				return game;
			} );

		it.live(
			"stamps each standing with the side its player was on",
			() => Effect.gen( function* () {
				const game = yield* finishedWith( "compile-stamp", {} );
				const view = yield* game.view();

				for ( const standing of view.results!.ranking ) {
					assert.strictEqual(
						standing.team,
						view.context.teams[ standing.playerId ],
						standing.playerId
					);
				}
			} )
		);

		it.live(
			"places the sides on total score where the game scores",
			() => Effect.gen( function* () {
				// Fish fills `teamRanking` itself, so this path has never run.
				const game = yield* started( "compile-scored" );
				const order = ( yield* game.view() ).context.players;

				// Seats alternate sides, so give the odd seats the points.
				for ( let i = 0; i < order.length; i++ ) {
					const seat = ( yield* game.view() ).context.currentPlayer!;
					yield* game.move( seat, "gain", { points: order.indexOf( seat ) % 2 === 1 ? 5 : 1 } );
				}

				yield* game.move( ( yield* game.view() ).context.currentPlayer!, "end", {} );

				const view = yield* game.view();
				const winning = view.context.teams[ order[ 1 ]! ];

				assert.strictEqual( view.results?.winningTeam, winning );
				assert.strictEqual( view.results?.teamRanking?.length, 2 );
				assert.deepStrictEqual(
					view.results?.teamRanking?.map( entry => entry.score ),
					[ 10, 2 ]
				);
				assert.deepStrictEqual(
					view.results?.teamRanking?.map( entry => entry.rank ),
					[ 1, 2 ]
				);
			} )
		);

		it.live(
			"places them on each side's best rank where it does not",
			() => Effect.gen( function* () {
				const game = yield* started( "compile-unscored", { scoring: false } );
				const order = ( yield* game.view() ).context.players;

				for ( let i = 0; i < order.length; i++ ) {
					const seat = ( yield* game.view() ).context.currentPlayer!;
					yield* game.move( seat, "gain", { points: order.indexOf( seat ) === 1 ? 9 : 1 } );
				}

				yield* game.move( ( yield* game.view() ).context.currentPlayer!, "end", {} );

				const view = yield* game.view();

				// No score on any standing, so the sides are placed by their best player.
				for ( const standing of view.results!.ranking ) {
					assert.isUndefined( standing.score );
				}

				assert.strictEqual( view.results?.winningTeam, view.context.teams[ order[ 1 ]! ] );
				for ( const side of view.results!.teamRanking! ) {
					assert.isUndefined( side.score, "nothing to report" );
				}
			} )
		);

		it.live( "drops the single-player winner for a team game", () => Effect.gen( function* () {
			// It names one player, which has no meaning when a side wins together.
			const game = yield* finishedWith( "compile-no-winner", {} );
			const view = yield* game.view();

			assert.isUndefined( view.results?.winner );
			assert.isDefined( view.results?.winningTeam );
		} ) );

		it.live( "lets sides level on the key share a rank", () => Effect.gen( function* () {
			const game = yield* finishedWith( "compile-tied", {} );
			const view = yield* game.view();

			// Everybody scored nothing, so both sides total zero.
			assert.deepStrictEqual(
				view.results?.teamRanking?.map( entry => entry.rank ),
				[ 1, 1 ]
			);
		} ) );

		it.live( "writes the side each seat ended up on", () => Effect.gen( function* () {
			// The sides are final once the game starts, so that is when the archive
			// is told — and it has to be told, because `updateResults` reads the
			// column back to decide which seats were on the winning side.
			const game = yield* finishedWith( "compile-archive", {} );

			const stamped = game.ledger.of( "update", "game_players" )
				.map( call => call.values as { team?: string | null } )
				.filter( values => values.team !== undefined && values.team !== null );

			assert.strictEqual( stamped.length, 4, "one per seat" );
			for ( const values of stamped ) {
				assert.oneOf( values.team, [ SIDE_A, SIDE_B ] );
			}
		} ) );

		it.live( "marks the winning side's seats as winners", () => Effect.gen( function* () {
			const game = yield* started( "compile-winners" );
			const order = ( yield* game.view() ).context.players;

			// Give one side the points so there is a winning side to mark.
			for ( let i = 0; i < order.length; i++ ) {
				const seat = ( yield* game.view() ).context.currentPlayer!;
				yield* game.move( seat, "gain", { points: order.indexOf( seat ) % 2 === 1 ? 5 : 1 } );
			}

			yield* game.move( ( yield* game.view() ).context.currentPlayer!, "end", {} );

			const view = yield* game.view();
			const winners = view.results!.ranking.filter(
				standing => standing.team === view.results!.winningTeam
			);

			assert.strictEqual( winners.length, 2 );

			const stamped = game.ledger.of( "update", "game_players" )
				.map( call => call.values as { isWinner?: boolean } )
				.filter( values => values.isWinner !== undefined );

			assert.strictEqual( stamped.length, 4, "every seat is stamped" );
			assert.strictEqual(
				stamped.filter( values => values.isWinner ).length,
				winners.length,
				"and the winning side's seats are the winners"
			);
		} ) );
	} );
} );
