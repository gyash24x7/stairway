import { describe, expect, test } from "bun:test";

import { planRematch } from "@/swish/shared/rematch.ts";
import { GameContext, PlayerId, PlayerInfo, TeamId, TeamName } from "@/swish/shared/schema.ts";

import type { RematchSource } from "@/swish/shared/rematch.ts";
import type { BaseGameConfig, Roster } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );
const team = ( id: string ) => TeamId.make( id );

const RED = team( "red" );
const BLUE = team( "blue" );

const [ a, b, c, d ] = [ player( "a" ), player( "b" ), player( "c" ), player( "d" ) ];

const human = ( id: PlayerId ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: `avatar-${ id }` } );

const bot = ( id: PlayerId ) =>
	PlayerInfo.make( { id, name: `bot ${ id }`, avatar: `bot-avatar-${ id }`, isBot: true } );

const rosterOf = ( ...people: ReadonlyArray<PlayerInfo> ): Roster =>
	Object.fromEntries( people.map( person => [ person.id, person ] ) );

const contextOf = ( options: {
	readonly players: ReadonlyArray<PlayerId>;
	readonly teams?: Record<PlayerId, TeamId>;
	readonly teamNames?: Record<TeamId, TeamName>;
} ) => GameContext.make( {
	turn: 0,
	players: options.players,
	currentPlayer: options.players[ 0 ] ?? a,
	interactions: [],
	seats: {},
	teams: options.teams ?? {},
	teamNames: options.teamNames ?? {}
} );

const configOf = ( teams?: ReadonlyArray<TeamId> ): BaseGameConfig =>
	( { playerCount: 4, autoStart: false, ...( teams ? { teams } : {} ) } );

const sourceOf = ( source: RematchSource ) => source;

describe( "planRematch", () => {

	test( "seats everyone in the order they sat, not the roster's key order", () => {
		// The roster is deliberately keyed in a different order from the seating, the
		// way a team game's is after `start` interleaves the sides.
		const plan = planRematch( sourceOf( {
			players: rosterOf( human( a ), human( b ), human( c ), human( d ) ),
			context: contextOf( { players: [ c, a, d, b ] } ),
			config: configOf()
		} ), false );

		expect( plan.players.map( person => person.id ) ).toEqual( [ c, a, d, b ] );
	} );

	test( "carries bots across whole rather than leaving them to be re-minted", () => {
		const machine = bot( c );

		const plan = planRematch( sourceOf( {
			players: rosterOf( human( a ), human( b ), machine ),
			context: contextOf( { players: [ a, b, c ] } ),
			config: configOf()
		} ), false );

		expect( plan.players[ 2 ] ).toEqual( machine );
		expect( plan.players[ 2 ]?.isBot ).toBe( true );
	} );

	test( "keeps the sides and their names when asked to", () => {
		const plan = planRematch( sourceOf( {
			players: rosterOf( human( a ), human( b ), human( c ), human( d ) ),
			context: contextOf( {
				players: [ a, b, c, d ],
				teams: { [ a ]: RED, [ b ]: BLUE, [ c ]: RED, [ d ]: BLUE },
				teamNames: { [ RED ]: TeamName.make( "The Aces" ) }
			} ),
			config: configOf( [ RED, BLUE ] )
		} ), true );

		expect( plan.teams ).toEqual( [
			{ playerId: a, team: RED },
			{ playerId: b, team: BLUE },
			{ playerId: c, team: RED },
			{ playerId: d, team: BLUE }
		] );

		// Named by someone who is on that side — `nameTeam` refuses anyone else.
		expect( plan.teamNames ).toEqual( [
			{ team: RED, name: TeamName.make( "The Aces" ), by: a }
		] );
	} );

	test( "leaves a side that was never named unnamed", () => {
		const plan = planRematch( sourceOf( {
			players: rosterOf( human( a ), human( b ) ),
			context: contextOf( {
				players: [ a, b ],
				teams: { [ a ]: RED, [ b ]: BLUE }
			} ),
			config: configOf( [ RED, BLUE ] )
		} ), true );

		expect( plan.teamNames ).toEqual( [] );
	} );

	test( "dissolves the sides and their names when asked to", () => {
		const plan = planRematch( sourceOf( {
			players: rosterOf( human( a ), human( b ) ),
			context: contextOf( {
				players: [ a, b ],
				teams: { [ a ]: RED, [ b ]: BLUE },
				teamNames: { [ RED ]: TeamName.make( "The Aces" ) }
			} ),
			config: configOf( [ RED, BLUE ] )
		} ), false );

		expect( plan.teams ).toEqual( [] );
		expect( plan.teamNames ).toEqual( [] );
		expect( plan.players.map( person => person.id ) ).toEqual( [ a, b ] );
	} );

	test( "assigns nothing in a game that has no sides, either way", () => {
		const source = sourceOf( {
			players: rosterOf( human( a ), human( b ) ),
			context: contextOf( { players: [ a, b ] } ),
			config: configOf()
		} );

		for ( const keepTeams of [ true, false ] ) {
			const plan = planRematch( source, keepTeams );
			expect( plan.teams ).toEqual( [] );
			expect( plan.teamNames ).toEqual( [] );
		}
	} );

	test( "drops a seat the roster has no record of rather than seating a hole", () => {
		const plan = planRematch( sourceOf( {
			players: rosterOf( human( a ) ),
			context: contextOf( { players: [ a, b ] } ),
			config: configOf()
		} ), false );

		expect( plan.players.map( person => person.id ) ).toEqual( [ a ] );
	} );

	test( "ignores a side the config no longer declares", () => {
		const plan = planRematch( sourceOf( {
			players: rosterOf( human( a ), human( b ) ),
			context: contextOf( {
				players: [ a, b ],
				teams: { [ a ]: RED, [ b ]: team( "green" ) }
			} ),
			config: configOf( [ RED, BLUE ] )
		} ), true );

		expect( plan.teams ).toEqual( [ { playerId: a, team: RED } ] );
	} );
} );
