import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player, TeamId as Team } from "@/swish/shared/schema.ts";
import { GameCode, GameId, PlayerId, PlayerInfo, TeamId } from "@/swish/shared/schema.ts";
import { teamOf } from "@/swish/shared/teams.ts";
import { TestHost } from "@tests/helpers/host.ts";
import type { TallyConfig } from "@tests/helpers/games/tally.ts";
import { tallyEngine } from "@tests/helpers/games/tally.ts";

import type { UserId } from "@/auth/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );
const team = ( id: string ) => TeamId.make( id );

const RED = team( "red" );
const BLUE = team( "blue" );

const [ a, b, c, d ] = [ player( "a" ), player( "b" ), player( "c" ), player( "d" ) ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const configOf = ( teams?: ReadonlyArray<Team> ): TallyConfig =>
	( { playerCount: 4, autoStart: false, ...( teams ? { teams } : {} ) } );

/**
 * Drives the toy game against in-memory host services. Everything a test needs
 * to reach — the commit log and the archive — is handed back alongside the
 * engine's commands.
 */
const run = <A, E>(
	body: ( engine: Effect.Success<typeof tallyEngine> ) => Effect.Effect<A, E>
) => {
	const cells = new Map<string, unknown>();
	const saved = new Map<string, unknown>();

	const program = Effect.gen( function* () {
		const engine = yield* tallyEngine;
		return yield* body( engine );
	} ).pipe( Effect.provide( TestHost( { cells, saved } ) ) );

	return { result: Effect.runSync( program ), cells, saved };
};

const create = ( config: TallyConfig ) => ( {
	id: GameId.make( "game-1" ),
	code: GameCode.make( "CODE" ),
	creator: "a" as UserId,
	config
} );

const commitsIn = ( cells: Map<string, unknown> ) =>
	[ ...cells.entries() ]
		.filter( ( [ key ] ) => key.startsWith( "log:commit:" ) )
		.sort( ( x, y ) => Number( x[ 0 ].split( ":" )[ 2 ] ) - Number( y[ 0 ].split( ":" )[ 2 ] ) )
		.map( ( [ , commit ] ) => commit as {
			command: string;
			events: Array<{ _tag: string }>;
		} );

describe( "a game without teams", () => {
	test( "start commits no team events and leaves the seating order alone", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf() ) );
			for ( const seat of [ a, b, c, d ] ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );
			return yield* engine.getState();
		} ) );

		expect( result.context.players ).toEqual( [ a, b, c, d ] );
		expect( result.context.teams ).toEqual( {} );

		const startCommit = commitsIn( cells ).find( commit => commit.command === "start" );
		const tags = startCommit?.events.map( event => event._tag ) ?? [];
		expect( tags ).not.toContain( "swish/ev/TeamAssigned" );
		expect( tags ).not.toContain( "swish/ev/SeatOrderSet" );
	} );

	test( "refuses a side", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf() ) );
			yield* engine.join( info( a ) );
			return yield* engine.joinTeam( a, RED ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/TeamsUnavailable" );
	} );
} );

describe( "initialize", () => {
	const refuses = ( teams: ReadonlyArray<Team>, playerCount = 4 ) =>
		run( engine =>
			engine.initialize( create( { playerCount, autoStart: false, teams } ) ).pipe( Effect.flip )
		).result;

	test( "refuses a single side", () => {
		expect( refuses( [ RED ] )._tag ).toBe( "swish/InvalidTeamConfig" );
	} );

	test( "refuses duplicate sides", () => {
		expect( refuses( [ RED, RED ] )._tag ).toBe( "swish/InvalidTeamConfig" );
	} );

	test( "refuses seats that do not split evenly", () => {
		expect( refuses( [ RED, BLUE ], 5 )._tag ).toBe( "swish/InvalidTeamConfig" );
	} );

	test( "seats an empty membership map", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			return yield* engine.getState();
		} ) );

		expect( result.context.teams ).toEqual( {} );
	} );
} );

describe( "taking a side in the lobby", () => {
	test( "a seated player takes a side", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			yield* engine.joinTeam( a, BLUE );
			return yield* engine.getState();
		} ) );

		expect( result.context.teams ).toEqual( { [ a ]: BLUE } );
	} );

	test( "joinTeam moves a seated player", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			yield* engine.joinTeam( a, BLUE );
			yield* engine.joinTeam( a, RED );
			return yield* engine.getState();
		} ) );

		expect( result.context.teams ).toEqual( { [ a ]: RED } );
	} );

	test( "joinTeam to the side already held commits nothing", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			yield* engine.joinTeam( a, RED );
			const before = yield* engine.getState();
			yield* engine.joinTeam( a, RED );
			const after = yield* engine.getState();
			return { before, after };
		} ) );

		// Only the first pick commits. Otherwise every toggle in the lobby would
		// cost a commit and a full record.
		expect( result.after.version ).toBe( result.before.version );
		expect( commitsIn( cells ).filter( commit => commit.command === "joinTeam" ) )
			.toHaveLength( 1 );
	} );

	test( "a re-join keeps the side already held", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			yield* engine.joinTeam( a, RED );
			yield* engine.join( info( a ) );
			return yield* engine.getState();
		} ) );

		expect( result.context.teams[ a ] ).toBe( RED );
	} );

	test( "refuses a side the config does not declare", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			return yield* engine.joinTeam( a, team( "green" ) ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/TeamNotFound" );
	} );

	test( "refuses a side that is already full", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			yield* engine.joinTeam( a, RED );
			yield* engine.join( info( b ) );
			yield* engine.joinTeam( b, RED );
			yield* engine.join( info( c ) );
			return yield* engine.joinTeam( c, RED ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/TeamFull" );
	} );

	test( "refuses a player who holds no seat", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			return yield* engine.joinTeam( b, RED ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );

	test( "refuses once the game has started", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			for ( const seat of [ a, b, c, d ] ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );
			return yield* engine.joinTeam( a, RED ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotJoinable" );
	} );
} );

describe( "naming a side", () => {
	const lobby = <A, E>(
		body: ( engine: Effect.Success<typeof tallyEngine> ) => Effect.Effect<A, E>
	) => run( engine => Effect.gen( function* () {
		yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
		for ( const seat of [ a, b, c ] ) {
			yield* engine.join( info( seat ) );
		}

		yield* engine.joinTeam( a, RED );
		yield* engine.joinTeam( b, BLUE );
		yield* engine.joinTeam( c, RED );
		return yield* body( engine );
	} ) );

	test( "a member names their own side", () => {
		const { result } = lobby( engine => Effect.gen( function* () {
			yield* engine.nameTeam( a, RED, "The Aces" );
			return yield* engine.getState();
		} ) );

		expect( result.context.teamNames[ RED ] ).toBe( "The Aces" );
		expect( result.context.teamNames[ BLUE ] ).toBeUndefined();
	} );

	test( "the name rides the wire on the context", () => {
		const { result } = lobby( engine => Effect.gen( function* () {
			yield* engine.nameTeam( a, RED, "The Aces" );
			yield* engine.nameTeam( b, BLUE, "The Kings" );
			return yield* engine.getState( a );
		} ) );

		expect( result.context.teamNames ).toEqual( { [ RED ]: "The Aces", [ BLUE ]: "The Kings" } );
	} );

	test( "a second attempt on the same side is refused, name unchanged", () => {
		const { result } = lobby( engine => Effect.gen( function* () {
			yield* engine.nameTeam( a, RED, "The Aces" );
			const refusal = yield* engine.nameTeam( a, RED, "The Aces Again" ).pipe( Effect.flip );
			const after = yield* engine.getState();
			return { refusal, after };
		} ) );

		expect( result.refusal._tag ).toBe( "swish/TeamAlreadyNamed" );
		expect( result.after.context.teamNames[ RED ] ).toBe( "The Aces" );
	} );

	test( "a teammate cannot rename it either", () => {
		const { result } = lobby( engine => Effect.gen( function* () {
			yield* engine.nameTeam( a, RED, "The Aces" );
			// `c` is on red too — set-once binds the side, not the player.
			const refusal = yield* engine.nameTeam( c, RED, "The Jokers" ).pipe( Effect.flip );
			const after = yield* engine.getState();
			return { refusal, after };
		} ) );

		expect( result.refusal._tag ).toBe( "swish/TeamAlreadyNamed" );
		expect( result.after.context.teamNames[ RED ] ).toBe( "The Aces" );
	} );

	test( "refuses naming a side the caller does not play on", () => {
		const { result } = lobby( engine =>
			engine.nameTeam( a, BLUE, "Wrong Side" ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/NotOnTeam" );
	} );

	test( "refuses a seat that picked no side at all", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			return yield* engine.nameTeam( a, RED, "The Aces" ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotOnTeam" );
	} );

	test( "refuses a side the config does not declare", () => {
		const { result } = lobby( engine =>
			engine.nameTeam( a, team( "green" ), "Nowhere" ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/TeamNotFound" );
	} );

	test( "refuses a player who holds no seat", () => {
		const { result } = lobby( engine =>
			engine.nameTeam( d, RED, "Gatecrasher" ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );

	test( "refuses a name the schema will not take", () => {
		const { result } = lobby( engine => Effect.gen( function* () {
			const empty = yield* engine.nameTeam( a, RED, "" ).pipe( Effect.flip );
			const long = yield* engine.nameTeam( a, RED, "x".repeat( 33 ) ).pipe( Effect.flip );
			const after = yield* engine.getState();
			return { empty, long, after };
		} ) );

		expect( result.empty._tag ).toBe( "swish/InvalidTeamName" );
		expect( result.long._tag ).toBe( "swish/InvalidTeamName" );
		// A rejected name must not have consumed the side's one chance.
		expect( result.after.context.teamNames[ RED ] ).toBeUndefined();
	} );

	test( "accepts a name exactly at the cap", () => {
		const { result } = lobby( engine => Effect.gen( function* () {
			yield* engine.nameTeam( a, RED, "x".repeat( 32 ) );
			return yield* engine.getState();
		} ) );

		expect( result.context.teamNames[ RED ] ).toHaveLength( 32 );
	} );

	test( "refuses once the game has started", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			for ( const seat of [ a, b, c, d ] ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );
			const named = yield* engine.getState();
			const refusal = yield* engine
				.nameTeam(
					named.context.players[ 0 ]!,
					named.context.teams[ named.context.players[ 0 ]! ]!,
					"Too Late"
				)
				.pipe( Effect.flip );

			return refusal;
		} ) );

		expect( result._tag ).toBe( "swish/GameNotJoinable" );
	} );

	test( "a name set in the lobby survives the start", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			yield* engine.join( info( a ) );
			yield* engine.joinTeam( a, RED );
			yield* engine.nameTeam( a, RED, "The Aces" );
			for ( const seat of [ b, c, d ] ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );
			return yield* engine.getState();
		} ) );

		expect( result.context.teamNames[ RED ] ).toBe( "The Aces" );
	} );

	test( "the name stays with the side when its namer switches away", () => {
		const { result } = lobby( engine => Effect.gen( function* () {
			yield* engine.nameTeam( a, RED, "The Aces" );
			yield* engine.joinTeam( a, BLUE );
			return yield* engine.getState();
		} ) );

		// A name belongs to the team, not to whoever happened to choose it.
		expect( result.context.teamNames[ RED ] ).toBe( "The Aces" );
		expect( result.context.teams[ a ] ).toBe( BLUE );
	} );
} );

describe( "start", () => {
	const started = ( picks: Partial<Record<Player, Team>> = {} ) =>
		run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			for ( const seat of [ a, b, c, d ] ) {
				yield* engine.join( info( seat ) );

				const pick = picks[ seat ];
				if ( pick ) {
					yield* engine.joinTeam( seat, pick );
				}
			}
			yield* engine.start( a );
			return yield* engine.getState();
		} ) );

	test( "balances every seat onto a side", () => {
		const { result } = started();
		const sides = result.context.players.map( id => result.context.teams[ id ] );

		expect( sides.filter( side => side === RED ) ).toHaveLength( 2 );
		expect( sides.filter( side => side === BLUE ) ).toHaveLength( 2 );
	} );

	test( "seats the sides so they alternate", () => {
		const { result } = started();
		const sides = result.context.players.map( id => result.context.teams[ id ] );

		expect( sides[ 0 ] ).not.toBe( sides[ 1 ] );
		expect( sides[ 0 ] ).toBe( sides[ 2 ] );
		expect( sides[ 1 ] ).toBe( sides[ 3 ] );
	} );

	test( "keeps every seat when it reorders them", () => {
		const { result } = started();
		expect( [ ...result.context.players ].sort() ).toEqual( [ a, b, c, d ].sort() );
	} );

	test( "honours the picks made in the lobby", () => {
		const { result } = started( { [ a ]: BLUE, [ b ]: BLUE } );

		expect( result.context.teams[ a ] ).toBe( BLUE );
		expect( result.context.teams[ b ] ).toBe( BLUE );
		expect( result.context.teams[ c ] ).toBe( RED );
		expect( result.context.teams[ d ] ).toBe( RED );
	} );

	test( "opens with whoever sat first", () => {
		const { result } = started( { [ a ]: BLUE, [ b ]: BLUE } );

		expect( result.context.players[ 0 ] ).toBe( a );
		expect( result.context.currentPlayer ).toBe( a );
	} );

	test( "commits the sides, the order and the opening seat, in that order", () => {
		const { cells } = started();
		const startCommit = commitsIn( cells ).find( commit => commit.command === "start" );
		const tags = startCommit?.events.map( event => event._tag ) ?? [];

		const lastAssigned = tags.lastIndexOf( "swish/ev/TeamAssigned" );
		const order = tags.indexOf( "swish/ev/SeatOrderSet" );
		const opening = tags.indexOf( "swish/ev/CurrentPlayerSet" );

		expect( tags.filter( tag => tag === "swish/ev/TeamAssigned" ) ).toHaveLength( 4 );
		expect( lastAssigned ).toBeLessThan( order );
		expect( order ).toBeLessThan( opening );
		expect( opening ).toBeLessThan( tags.indexOf( "swish/ev/StatusChanged" ) );
	} );
} );

describe( "turn order", () => {
	test( "hands the turn to the other side each time", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			for ( const seat of [ a, b, c, d ] ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );

			const opening = yield* engine.getState();
			const order = opening.context.players;

			const sides: Array<Team | undefined> = [];
			for ( const seat of order ) {
				const before = yield* engine.getState();
				sides.push( teamOf( before.context, before.context.currentPlayer ) );
				yield* engine.score( { points: 1 }, seat );
			}

			return sides;
		} ) );

		expect( result[ 0 ] ).not.toBe( result[ 1 ] );
		expect( result[ 1 ] ).not.toBe( result[ 2 ] );
		expect( result[ 2 ] ).not.toBe( result[ 3 ] );
	} );
} );

describe( "history", () => {
	test( "a rebuild reproduces the sides and the seating order", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			for ( const seat of [ a, b, c, d ] ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );

			const before = yield* engine.getState();
			yield* engine.score( { points: 3 }, before.context.players[ 0 ]! );

			// Undo and redo both refold the record from the log, so a round trip
			// through them rebuilds the very state the events were folded into.
			const played = yield* engine.getState();
			yield* engine.undo( before.context.players[ 0 ]! );
			yield* engine.redo( before.context.players[ 0 ]! );
			const rebuilt = yield* engine.getState();

			return { played, rebuilt };
		} ) );

		expect( result.rebuilt.context.teams ).toEqual( result.played.context.teams );
		expect( result.rebuilt.context.players ).toEqual( result.played.context.players );
		expect( result.rebuilt.version ).toBe( result.played.version );
	} );

	test( "undo stops at the start commit, so the sides are never rewound", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
			for ( const seat of [ a, b, c, d ] ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );

			const opening = yield* engine.getState();
			const first = opening.context.players[ 0 ]!;

			yield* engine.score( { points: 3 }, first );
			yield* engine.undo( first );

			const rewound = yield* engine.getState();
			const refusal = yield* engine.undo( first ).pipe( Effect.flip );

			return { rewound, refusal };
		} ) );

		expect( result.refusal._tag ).toBe( "swish/NothingToUndo" );
		expect( Object.keys( result.rewound.context.teams ) ).toHaveLength( 4 );
		expect( result.rewound.context.players ).toHaveLength( 4 );
	} );
} );

describe( "results", () => {
	const completed = () => run( engine => Effect.gen( function* () {
		yield* engine.initialize( create( configOf( [ RED, BLUE ] ) ) );
		for ( const seat of [ a, b, c, d ] ) {
			yield* engine.join( info( seat ) );
			yield* engine.joinTeam( seat, seat === a || seat === c ? RED : BLUE );
		}
		yield* engine.start( a );

		const opening = yield* engine.getState();
		for ( const seat of opening.context.players ) {
			// Red scores 10 apiece, blue 1.
			yield* engine.score( { points: teamOf( opening.context, seat ) === RED ? 10 : 1 }, seat );
		}

		return yield* engine.getState();
	} ) );

	test( "stamps every player with their side", () => {
		const { result } = completed();
		const ranking = result.results?.ranking ?? [];

		expect( ranking ).toHaveLength( 4 );
		for ( const standing of ranking ) {
			expect( standing.team )
				.toBe( standing.playerId === a || standing.playerId === c ? RED : BLUE );
		}
	} );

	test( "compiles the per-side ranking and names the winning side", () => {
		const { result } = completed();

		expect( result.results?.teamRanking ).toEqual( [
			{ team: RED, rank: 1, score: 20 },
			{ team: BLUE, rank: 2, score: 2 }
		] );
		expect( result.results?.winningTeam ).toBe( RED );
	} );

	test( "puts the aggregate in the event, not only in the folded record", () => {
		const { cells } = completed();
		const resolved = commitsIn( cells )
			.flatMap( commit => commit.events )
			.find( event => event._tag === "swish/ev/ResultsResolved" ) as
			undefined | { results: { winningTeam?: Team; teamRanking?: ReadonlyArray<unknown> } };

		expect( resolved?.results.winningTeam ).toBe( RED );
		expect( resolved?.results.teamRanking ).toHaveLength( 2 );
	} );

	test( "archives the completed game with its sides intact", () => {
		const { saved } = completed();
		const archived = saved.get( "tally:game-1" ) as
			undefined | { context: { teams: Record<Player, Team> } };

		expect( Object.keys( archived?.context.teams ?? {} ) ).toHaveLength( 4 );
	} );
} );
