import { describe, expect, test } from "bun:test";

import { PlayerId } from "@/shared/swish/schema.ts";
import { makeStandings } from "@/shared/swish/standings.ts";

const pid = ( id: string ) => PlayerId.make( id );

/**
 * The common case: rank a roster by a plain numeric score, best-first.
 * `scores` doubles as the roster (its key order is the seating order).
 */
const byScore = (
	scores: Record<string, number>,
	opts: { ties?: "competition" | "dense"; team?: Record<string, string> } = {}
) => makeStandings( {
	players: Object.keys( scores ).map( pid ),
	compare: ( a, b ) => ( scores[ b ] ?? 0 ) - ( scores[ a ] ?? 0 ),
	score: ( id ) => scores[ id ],
	ties: opts.ties,
	team: opts.team ? ( id ) => opts.team![ id ] : undefined
} );

describe( "swish/standings — ordering", () => {

	test( "ranks best-first regardless of seating order", () => {
		const { ranking } = byScore( { a: 3, b: 9, c: 6 } );

		expect( ranking.map( ( r ) => r.playerId ) ).toEqual( [ pid( "b" ), pid( "c" ), pid( "a" ) ] );
		expect( ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 2, 3 ] );
	} );

	test( "carries the score through to each standing", () => {
		const { ranking } = byScore( { a: 3, b: 9 } );

		expect( ranking.map( ( r ) => r.score ) ).toEqual( [ 9, 3 ] );
	} );

	test( "omits score and team when the spec supplies no accessor", () => {
		const { ranking } = makeStandings( {
			players: [ pid( "a" ), pid( "b" ) ],
			compare: () => 0
		} );

		expect( ranking[ 0 ]!.score ).toBeUndefined();
		expect( ranking[ 0 ]!.team ).toBeUndefined();
	} );

	test( "an empty roster produces an empty ranking and no winner", () => {
		const standings = makeStandings( { players: [], compare: () => 0 } );

		expect( standings.ranking ).toEqual( [] );
		expect( standings.winner ).toBeUndefined();
	} );

	test( "ties keep seating order — the sort is stable", () => {
		const { ranking } = byScore( { a: 5, b: 5, c: 5 } );

		expect( ranking.map( ( r ) => r.playerId ) )
			.toEqual( [ pid( "a" ), pid( "b" ), pid( "c" ) ] );
	} );
} );

describe( "swish/standings — ties", () => {

	test( "tied seats share a rank", () => {
		const { ranking } = byScore( { a: 9, b: 9, c: 1 } );

		expect( ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 1, 3 ] );
	} );

	test( "competition ranking skips the seats a tie spans", () => {
		const { ranking } = byScore( { a: 9, b: 5, c: 5, d: 1 } );

		expect( ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 2, 2, 4 ] );
	} );

	test( "dense ranking never skips a placement", () => {
		const { ranking } = byScore( { a: 9, b: 5, c: 5, d: 1 }, { ties: "dense" } );

		expect( ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 2, 2, 3 ] );
	} );

	test( "dense ranking places a losing team of three 2nd, not 4th", () => {
		const scores = { a: 6, b: 6, c: 6, x: 2, y: 2, z: 2 };
		const teams = { a: "RED", b: "RED", c: "RED", x: "BLUE", y: "BLUE", z: "BLUE" };
		const { ranking } = byScore( scores, { ties: "dense", team: teams } );

		expect( ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 1, 1, 2, 2, 2 ] );
		expect( ranking.map( ( r ) => r.team ) )
			.toEqual( [ "RED", "RED", "RED", "BLUE", "BLUE", "BLUE" ] );
	} );

	test( "every seat level collapses to a single shared rank", () => {
		const { ranking } = byScore( { a: 4, b: 4, c: 4 } );

		expect( ranking.map( ( r ) => r.rank ) ).toEqual( [ 1, 1, 1 ] );
	} );
} );

describe( "swish/standings — winner", () => {

	test( "crowns the seat that strictly outranks the runner-up", () => {
		expect( byScore( { a: 3, b: 9, c: 6 } ).winner ).toBe( pid( "b" ) );
	} );

	test( "a lone seat wins outright", () => {
		expect( byScore( { a: 3 } ).winner ).toBe( pid( "a" ) );
	} );

	test( "a tie at the top has no outright winner", () => {
		expect( byScore( { a: 9, b: 9, c: 1 } ).winner ).toBeUndefined();
	} );

	test( "a tie below the top does not disturb the winner", () => {
		expect( byScore( { a: 9, b: 5, c: 5 } ).winner ).toBe( pid( "a" ) );
	} );
} );
