import { describe, expect, test } from "bun:test";

import type {
	BaseGameConfig,
	PlayerId as Player,
	Standing,
	TeamId as Team
} from "@/swish/shared/schema.ts";
import { GameContext, PlayerId, TeamId } from "@/swish/shared/schema.ts";
import {
	areTeammates,
	balanceTeams,
	interleaveSeats,
	membersOf,
	nameOf,
	opponentsOf,
	rankTeams,
	teamOf,
	teamSize,
	validateTeamConfig
} from "@/swish/shared/teams.ts";

const player = ( id: string ) => PlayerId.make( id );
const team = ( id: string ) => TeamId.make( id );

const RED = team( "red" );
const BLUE = team( "blue" );
const GREEN = team( "green" );

const contextOf = ( players: ReadonlyArray<Player>, teams: Record<Player, Team> ) =>
	GameContext.make( {
		turn: 0,
		players,
		currentPlayer: players[ 0 ] ?? player( "nobody" ),
		interactions: [],
		seats: {},
		teams,
		teamNames: {}
	} );

const configOf = ( playerCount: number, teams?: ReadonlyArray<Team> ) =>
	( { playerCount, autoStart: false, ...( teams ? { teams } : {} ) } ) as BaseGameConfig;

const seats = ( count: number ) =>
	Array.from( { length: count }, ( _, index ) => player( `p${ index + 1 }` ) );

describe( "teamSize", () => {
	test( "splits the seats between the sides", () => {
		expect( teamSize( configOf( 4, [ RED, BLUE ] ) ) ).toBe( 2 );
		expect( teamSize( configOf( 6, [ RED, BLUE, GREEN ] ) ) ).toBe( 2 );
	} );

	test( "is undefined for a game without teams", () => {
		expect( teamSize( configOf( 4 ) ) ).toBeUndefined();
	} );
} );

describe( "validateTeamConfig", () => {
	test( "accepts a game without teams", () => {
		expect( validateTeamConfig( configOf( 4 ) ) ).toBeUndefined();
	} );

	test( "accepts sides that divide the seats evenly", () => {
		expect( validateTeamConfig( configOf( 4, [ RED, BLUE ] ) ) ).toBeUndefined();
		expect( validateTeamConfig( configOf( 6, [ RED, BLUE, GREEN ] ) ) ).toBeUndefined();
	} );

	test( "rejects fewer than two sides", () => {
		expect( validateTeamConfig( configOf( 4, [ RED ] ) )?.reason ).toContain( "at least two" );
	} );

	test( "rejects duplicate ids", () => {
		expect( validateTeamConfig( configOf( 4, [ RED, RED ] ) )?.reason ).toContain( "unique" );
	} );

	test( "rejects seats that do not split evenly", () => {
		expect( validateTeamConfig( configOf( 5, [ RED, BLUE ] ) )?.reason ).toContain( "evenly" );
	} );
} );

describe( "balanceTeams", () => {
	test( "fills every seat when nobody picked", () => {
		const players = seats( 4 );
		const balanced = balanceTeams( [ RED, BLUE ], players, {} );

		expect( players.filter( id => balanced[ id ] === RED ) ).toHaveLength( 2 );
		expect( players.filter( id => balanced[ id ] === BLUE ) ).toHaveLength( 2 );
	} );

	test( "honours the picks already made and fills the rest around them", () => {
		const [ a, b, c, d ] = seats( 4 ) as [ Player, Player, Player, Player ];
		const balanced = balanceTeams( [ RED, BLUE ], [ a, b, c, d ], { [ a ]: BLUE, [ b ]: BLUE } );

		expect( balanced[ a ] ).toBe( BLUE );
		expect( balanced[ b ] ).toBe( BLUE );
		expect( balanced[ c ] ).toBe( RED );
		expect( balanced[ d ] ).toBe( RED );
	} );

	test( "ignores a pick naming a side the config does not declare", () => {
		const [ a, ...rest ] = seats( 4 ) as [ Player, ...Array<Player> ];
		const balanced = balanceTeams( [ RED, BLUE ], [ a, ...rest ], { [ a ]: GREEN } );

		expect( [ RED, BLUE ] ).toContain( balanced[ a ] );
	} );

	test( "is deterministic across repeated calls", () => {
		const players = seats( 6 );
		const once = balanceTeams( [ RED, BLUE, GREEN ], players, {} );
		const twice = balanceTeams( [ RED, BLUE, GREEN ], players, {} );

		expect( twice ).toEqual( once );
	} );

	test( "depends on the seating order, not on the roster's key order", () => {
		// A numeric-looking id sorts to the front of a record's keys. The balance
		// must not notice, or a rebuild from the log would diverge from the original.
		const players = [ player( "zed" ), player( "10" ), player( "2" ), player( "abe" ) ];

		const forwards: Record<Player, Team> = {};
		players.forEach( id => { forwards[ id ] = RED; } );

		const backwards: Record<Player, Team> = {};
		[ ...players ].reverse().forEach( id => { backwards[ id ] = RED; } );

		expect( balanceTeams( [ RED, BLUE ], players, {} ) )
			.toEqual( balanceTeams( [ RED, BLUE ], players, {} ) );

		// Same picks, inserted in the opposite order: same answer.
		expect( balanceTeams( [ RED, BLUE ], players, backwards ) )
			.toEqual( balanceTeams( [ RED, BLUE ], players, forwards ) );
	} );
} );

describe( "interleaveSeats", () => {
	test( "alternates two sides", () => {
		const players = seats( 4 );
		const balanced = balanceTeams( [ RED, BLUE ], players, {} );
		const order = interleaveSeats( [ RED, BLUE ], players, balanced );

		const sides = order.map( id => balanced[ id ] );
		expect( sides ).toEqual( [ sides[ 0 ]!, sides[ 1 ]!, sides[ 0 ]!, sides[ 1 ]! ] );
		expect( sides[ 0 ] ).not.toBe( sides[ 1 ] );
	} );

	test( "rotates three sides", () => {
		const players = seats( 6 );
		const balanced = balanceTeams( [ RED, BLUE, GREEN ], players, {} );
		const order = interleaveSeats( [ RED, BLUE, GREEN ], players, balanced );

		const sides = order.map( id => balanced[ id ] );
		expect( new Set( sides.slice( 0, 3 ) ).size ).toBe( 3 );
		expect( sides.slice( 3 ) ).toEqual( sides.slice( 0, 3 ) );
	} );

	test( "keeps whoever sat first opening the game", () => {
		const players = seats( 4 );
		const balanced = balanceTeams( [ RED, BLUE ], players, {} );
		const order = interleaveSeats( [ RED, BLUE ], players, balanced );

		expect( order[ 0 ] ).toBe( players[ 0 ]! );
	} );

	test( "keeps the opening seat even when they picked the second side", () => {
		const [ a, b, c, d ] = seats( 4 ) as [ Player, Player, Player, Player ];
		const balanced = { [ a ]: BLUE, [ b ]: RED, [ c ]: BLUE, [ d ]: RED };
		const order = interleaveSeats( [ RED, BLUE ], [ a, b, c, d ], balanced );

		expect( order[ 0 ] ).toBe( a );
		expect( order.map( id => balanced[ id ] ) ).toEqual( [ BLUE, RED, BLUE, RED ] );
	} );

	// The reducer applying this order cannot reject a bad one, and a dropped seat
	// would silently be served the table view instead of its own.
	describe( "is always a permutation of its input", () => {
		const cases: Array<[ string, ReadonlyArray<Team>, number ]> = [
			[ "2 sides, 4 seats", [ RED, BLUE ], 4 ],
			[ "2 sides, 8 seats", [ RED, BLUE ], 8 ],
			[ "3 sides, 6 seats", [ RED, BLUE, GREEN ], 6 ],
			[ "4 sides, 8 seats", [ RED, BLUE, GREEN, team( "gold" ) ], 8 ]
		];

		for ( const [ name, teams, count ] of cases ) {
			test( name, () => {
				const players = seats( count );
				const balanced = balanceTeams( teams, players, {} );
				const order = interleaveSeats( teams, players, balanced );

				expect( [ ...order ].sort() ).toEqual( [ ...players ].sort() );
			} );
		}

		test( "even when the sides are lopsided", () => {
			const players = seats( 5 );
			const lopsided = Object.fromEntries(
				players.map( ( id, index ) => [ id, index === 0 ? BLUE : RED ] )
			) as Record<Player, Team>;

			const order = interleaveSeats( [ RED, BLUE ], players, lopsided );
			expect( [ ...order ].sort() ).toEqual( [ ...players ].sort() );
		} );

		test( "even when a seat holds no side at all", () => {
			const players = seats( 4 );
			const partial = { [ players[ 0 ]! ]: RED, [ players[ 1 ]! ]: BLUE };

			const order = interleaveSeats( [ RED, BLUE ], players, partial as Record<Player, Team> );
			expect( [ ...order ].sort() ).toEqual( [ ...players ].sort() );
		} );
	} );
} );

describe( "membership lookups", () => {
	const [ a, b, c, d ] = seats( 4 ) as [ Player, Player, Player, Player ];
	const context = contextOf( [ a, b, c, d ], { [ a ]: RED, [ b ]: BLUE, [ c ]: RED, [ d ]: BLUE } );

	test( "teamOf reads a player's side", () => {
		expect( teamOf( context, a ) ).toBe( RED );
		expect( teamOf( context, b ) ).toBe( BLUE );
	} );

	test( "membersOf lists a side in seat order", () => {
		expect( membersOf( context, RED ) ).toEqual( [ a, c ] );
		expect( membersOf( context, BLUE ) ).toEqual( [ b, d ] );
	} );

	test( "areTeammates pairs the same side only", () => {
		expect( areTeammates( context, a, c ) ).toBe( true );
		expect( areTeammates( context, a, b ) ).toBe( false );
	} );

	test( "two unassigned players are not teammates", () => {
		const loose = contextOf( [ a, b ], {} as Record<Player, Team> );
		expect( areTeammates( loose, a, b ) ).toBe( false );
	} );

	test( "nameOf reads a side's chosen name, and nothing for an unnamed one", () => {
		const named = GameContext.make( {
			...contextOf( [ a, b, c, d ], { [ a ]: RED, [ b ]: BLUE, [ c ]: RED, [ d ]: BLUE } ),
			teamNames: { [ RED ]: "The Aces" }
		} );

		expect( nameOf( named, RED ) ).toBe( "The Aces" );
		expect( nameOf( named, BLUE ) ).toBeUndefined();
	} );

	test( "opponentsOf lists the other side in seat order", () => {
		expect( opponentsOf( context, a ) ).toEqual( [ b, d ] );
		expect( opponentsOf( context, b ) ).toEqual( [ a, c ] );
	} );

	test( "a game without teams has no opponents by side", () => {
		const loose = contextOf( [ a, b ], {} as Record<Player, Team> );
		expect( opponentsOf( loose, a ) ).toEqual( [] );
	} );

} );

describe( "rankTeams", () => {
	const standing = ( id: string, rank: number, side: Team, score?: number ): Standing =>
		( { playerId: player( id ), rank, team: side, ...( score === undefined ? {} : { score } ) } );

	test( "sums the scores on each side", () => {
		const { teamRanking, winningTeam } = rankTeams( [ RED, BLUE ], [
			standing( "a", 1, RED, 10 ),
			standing( "b", 2, RED, 5 ),
			standing( "c", 3, BLUE, 4 ),
			standing( "d", 4, BLUE, 3 )
		] );

		expect( winningTeam ).toBe( RED );
		expect( teamRanking ).toEqual( [
			{ team: RED, rank: 1, score: 15 },
			{ team: BLUE, rank: 2, score: 7 }
		] );
	} );

	test( "leaves a tie undecided and shares the rank", () => {
		const { teamRanking, winningTeam } = rankTeams( [ RED, BLUE ], [
			standing( "a", 1, RED, 6 ),
			standing( "b", 2, BLUE, 6 )
		] );

		expect( winningTeam ).toBeUndefined();
		expect( teamRanking.map( entry => entry.rank ) ).toEqual( [ 1, 1 ] );
	} );

	test( "ranks by the best player's rank when the game does not score", () => {
		const { teamRanking, winningTeam } = rankTeams( [ RED, BLUE ], [
			standing( "a", 2, RED ),
			standing( "b", 2, RED ),
			standing( "c", 1, BLUE ),
			standing( "d", 1, BLUE )
		] );

		expect( winningTeam ).toBe( BLUE );
		expect( teamRanking[ 0 ] ).toEqual( { team: BLUE, rank: 1 } );
		expect( teamRanking[ 1 ] ).toEqual( { team: RED, rank: 2 } );
	} );

	test( "a drawn unscored game names no winning side", () => {
		const { winningTeam } = rankTeams( [ RED, BLUE ], [
			standing( "a", 1, RED ),
			standing( "b", 1, BLUE )
		] );

		expect( winningTeam ).toBeUndefined();
	} );

	test( "orders three sides by total", () => {
		const { teamRanking, winningTeam } = rankTeams( [ RED, BLUE, GREEN ], [
			standing( "a", 3, RED, 1 ),
			standing( "b", 1, BLUE, 9 ),
			standing( "c", 2, GREEN, 5 )
		] );

		expect( winningTeam ).toBe( BLUE );
		expect( teamRanking.map( entry => entry.team ) ).toEqual( [ BLUE, GREEN, RED ] );
	} );
} );
