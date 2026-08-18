import { describe, expect, test } from "bun:test";

import type { BaseGameConfig, GameRecord } from "@/swish/shared/schema.ts";
import {
	CurrentPlayerSet,
	GameCode,
	GameCompleted,
	GameContext,
	GameId,
	InteractionFrame,
	InteractionOpened,
	InteractionResolved,
	InteractionResponded,
	PhaseEntered,
	PhaseExited,
	PlayerAudience,
	PlayerId,
	PlayerInfo,
	PlayerJoined,
	ResultsResolved,
	SeatOrderSet,
	SeatStatusChanged,
	StatusChanged,
	TableAudience,
	TeamAssigned,
	TeamId,
	TeamNamed,
	TurnAdvanced
} from "@/swish/shared/schema.ts";
import { Accumulator, engineApply, playerIdFor, toPlayerInfo } from "@/swish/server/utils.ts";

import type { AuthInfo } from "@/auth/shared/schema.ts";

type State = { readonly folded: ReadonlyArray<string> };
type Event = { readonly _tag: "test/Counted" };

const player = ( id: string ) => PlayerId.make( id );
const team = ( id: string ) => TeamId.make( id );

const RED = team( "red" );
const BLUE = team( "blue" );

const [ a, b, c, d ] = [ player( "a" ), player( "b" ), player( "c" ), player( "d" ) ];

const recordOf = (
	context: Partial<GameContext> = {}
): GameRecord<State, BaseGameConfig> => ( {
	id: GameId.make( "game-1" ),
	code: GameCode.make( "CODE" ),
	version: 0,
	status: "CREATED",
	players: {},
	seed: "seed",
	state: { folded: [] },
	config: { playerCount: 4, autoStart: false },
	context: GameContext.make( {
		turn: 0,
		players: [ a, b, c, d ],
		currentPlayer: a,
		interactions: [],
		seats: {},
		teams: {},
		teamNames: {},
		...context
	} )
} );

describe( "engineApply — TeamAssigned", () => {
	test( "records the side for that player alone", () => {
		const applied = engineApply( recordOf(), TeamAssigned.make( { playerId: a, team: RED } ) );

		expect( applied.context.teams[ a ] ).toBe( RED );
		expect( applied.context.teams[ b ] ).toBeUndefined();
	} );

	test( "moves a player who already held another side", () => {
		const start = recordOf( { teams: { [ a ]: RED } } );
		const applied = engineApply( start, TeamAssigned.make( { playerId: a, team: BLUE } ) );

		expect( applied.context.teams[ a ] ).toBe( BLUE );
	} );

	test( "heals a record stored before the field existed", () => {
		const legacy = recordOf();
		const stored = {
			...legacy,
			context: { ...legacy.context, teams: undefined }
		} as unknown as GameRecord<State, BaseGameConfig>;

		const applied = engineApply( stored, TeamAssigned.make( { playerId: a, team: RED } ) );

		expect( applied.context.teams ).toEqual( { [ a ]: RED } );
	} );

	test( "leaves the seating order and the seat statuses alone", () => {
		const start = recordOf( { seats: { [ b ]: "folded" } } );
		const applied = engineApply( start, TeamAssigned.make( { playerId: a, team: RED } ) );

		expect( applied.context.players ).toEqual( [ a, b, c, d ] );
		expect( applied.context.seats ).toEqual( { [ b ]: "folded" } );
		expect( applied.context.currentPlayer ).toBe( a );
	} );
} );

describe( "engineApply — SeatOrderSet", () => {
	test( "replaces the seating order", () => {
		const applied = engineApply( recordOf(), SeatOrderSet.make( { order: [ a, c, b, d ] } ) );

		expect( applied.context.players ).toEqual( [ a, c, b, d ] );
	} );

	test( "touches nothing else in the context", () => {
		const start = recordOf( { teams: { [ a ]: RED }, seats: { [ d ]: "out" } } );
		const applied = engineApply( start, SeatOrderSet.make( { order: [ a, c, b, d ] } ) );

		expect( applied.context.currentPlayer ).toBe( a );
		expect( applied.context.turn ).toBe( 0 );
		expect( applied.context.teams ).toEqual( { [ a ]: RED } );
		expect( applied.context.seats ).toEqual( { [ d ]: "out" } );
		expect( applied.players ).toEqual( {} );
	} );

	test( "does not mutate the record it was given", () => {
		const start = recordOf();
		engineApply( start, SeatOrderSet.make( { order: [ d, c, b, a ] } ) );

		expect( start.context.players ).toEqual( [ a, b, c, d ] );
	} );
} );

describe( "engineApply — the roster", () => {
	const joined = ( id: typeof a ) => PlayerJoined.make( {
		player: PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } )
	} );

	test( "PlayerJoined seats the player and appends them to the order", () => {
		const empty = recordOf( { players: [] } );
		const applied = engineApply( empty, joined( c ) );

		expect( applied.players[ c ]?.name ).toBe( "player c" );
		expect( applied.context.players ).toEqual( [ c ] );
	} );

	test( "the first seat taken becomes the current player", () => {
		const empty = recordOf( { players: [], currentPlayer: PlayerId.make( "creator" ) } );
		const applied = engineApply( empty, joined( c ) );

		expect( applied.context.currentPlayer ).toBe( c );
	} );

	test( "a later seat leaves the current player alone", () => {
		const one = recordOf( { players: [ c ], currentPlayer: c } );
		const applied = engineApply( one, joined( d ) );

		expect( applied.context.currentPlayer ).toBe( c );
		expect( applied.context.players ).toEqual( [ c, d ] );
	} );
} );

describe( "engineApply — the flow of a turn", () => {
	test( "CurrentPlayerSet moves the turn", () => {
		const applied = engineApply( recordOf(), CurrentPlayerSet.make( { playerId: c } ) );

		expect( applied.context.currentPlayer ).toBe( c );
	} );

	test( "TurnAdvanced counts one turn", () => {
		const applied = engineApply( recordOf( { turn: 4 } ), TurnAdvanced.make( {} ) );

		expect( applied.context.turn ).toBe( 5 );
	} );

	test( "PhaseEntered records the phase", () => {
		const applied = engineApply( recordOf(), PhaseEntered.make( { phase: "dealing" } ) );

		expect( applied.context.phase ).toBe( "dealing" );
	} );

	test( "PhaseExited changes nothing — it is there for the record", () => {
		const start = recordOf( { phase: "dealing" } );
		const applied = engineApply( start, PhaseExited.make( { phase: "dealing" } ) );

		expect( applied ).toEqual( start );
	} );
} );

describe( "engineApply — the game's status", () => {
	test( "StatusChanged sets it", () => {
		const applied = engineApply( recordOf(), StatusChanged.make( { status: "IN_PROGRESS" } ) );

		expect( applied.status ).toBe( "IN_PROGRESS" );
	} );

	test( "GameCompleted ends it, whatever it was", () => {
		const applied = engineApply( recordOf(), GameCompleted.make( {} ) );

		expect( applied.status ).toBe( "COMPLETED" );
	} );

	test( "ResultsResolved records the standings", () => {
		const results = { ranking: [ { playerId: a, rank: 1, score: 9 } ], winner: a };
		const applied = engineApply( recordOf(), ResultsResolved.make( { results } ) );

		expect( applied.results ).toEqual( results );
	} );
} );

describe( "engineApply — seats", () => {
	test( "SeatStatusChanged records it for that seat alone", () => {
		const applied = engineApply(
			recordOf(),
			SeatStatusChanged.make( { playerId: b, status: "folded" } )
		);

		expect( applied.context.seats ).toEqual( { [ b ]: "folded" } );
	} );

	test( "a later change replaces the earlier one", () => {
		const start = recordOf( { seats: { [ b ]: "folded" } } );
		const applied = engineApply(
			start,
			SeatStatusChanged.make( { playerId: b, status: "out" } )
		);

		expect( applied.context.seats[ b ] ).toBe( "out" );
	} );
} );

describe( "engineApply — the interaction stack", () => {
	const frame = InteractionFrame.make( {
		kind: "duel",
		initiator: a,
		responders: [ b, c ],
		mode: "sequential",
		responses: {}
	} );

	test( "InteractionOpened pushes a frame", () => {
		const applied = engineApply( recordOf(), InteractionOpened.make( { frame } ) );

		expect( applied.context.interactions ).toHaveLength( 1 );
		expect( applied.context.interactions[ 0 ]?.kind ).toBe( "duel" );
	} );

	test( "a second push stacks on top of the first", () => {
		const one = engineApply( recordOf(), InteractionOpened.make( { frame } ) );
		const two = engineApply( one, InteractionOpened.make( {
			frame: InteractionFrame.make( { ...frame, kind: "vote" } )
		} ) );

		expect( two.context.interactions.map( entry => entry.kind ) ).toEqual( [ "duel", "vote" ] );
	} );

	test( "InteractionResponded records against the frame on top", () => {
		const one = engineApply( recordOf(), InteractionOpened.make( { frame } ) );
		const applied = engineApply(
			one,
			InteractionResponded.make( { playerId: b, response: { value: true } } )
		);

		expect( applied.context.interactions[ 0 ]?.responses ).toEqual( { [ b ]: { value: true } } );
	} );

	test( "a response with no frame open is ignored rather than fatal", () => {
		const applied = engineApply(
			recordOf(),
			InteractionResponded.make( { playerId: b, response: {} } )
		);

		expect( applied.context.interactions ).toEqual( [] );
	} );

	test( "InteractionResolved pops the frame on top", () => {
		const one = engineApply( recordOf(), InteractionOpened.make( { frame } ) );
		const two = engineApply( one, InteractionOpened.make( {
			frame: InteractionFrame.make( { ...frame, kind: "vote" } )
		} ) );

		const applied = engineApply( two, InteractionResolved.make( {} ) );

		expect( applied.context.interactions.map( entry => entry.kind ) ).toEqual( [ "duel" ] );
	} );

	test( "resolving an empty stack is ignored rather than fatal", () => {
		const applied = engineApply( recordOf(), InteractionResolved.make( {} ) );

		expect( applied.context.interactions ).toEqual( [] );
	} );
} );

describe( "engineApply — a side's name", () => {
	test( "TeamNamed records it against the side", () => {
		const applied = engineApply( recordOf(), TeamNamed.make( { team: RED, name: "The Aces" } ) );

		expect( applied.context.teamNames[ RED ] ).toBe( "The Aces" );
		expect( applied.context.teamNames[ BLUE ] ).toBeUndefined();
	} );

	test( "heals a record stored before the field existed", () => {
		const legacy = recordOf();
		const stored = {
			...legacy,
			context: { ...legacy.context, teamNames: undefined }
		} as unknown as GameRecord<State, BaseGameConfig>;

		const applied = engineApply( stored, TeamNamed.make( { team: RED, name: "The Aces" } ) );

		expect( applied.context.teamNames ).toEqual( { [ RED ]: "The Aces" } );
	} );
} );

describe( "the audience helpers", () => {
	test( "a player's audience names them", () => {
		expect( playerIdFor( PlayerAudience.make( { playerId: a } ) ) ).toBe( a );
	} );

	test( "the table's audience names nobody", () => {
		expect( playerIdFor( TableAudience.make( {} ) ) ).toBeUndefined();
	} );
} );

describe( "toPlayerInfo", () => {
	test( "seats an authenticated user, as a person rather than a bot", () => {
		const info = toPlayerInfo( {
			id: "user-1",
			name: "Ada",
			avatar: "avatar"
		} as AuthInfo );

		expect( info ).toMatchObject( {
			id: "user-1",
			name: "Ada",
			avatar: "avatar"
		} );
		expect( info.isBot ).toBeUndefined();
	} );
} );

describe( "Accumulator", () => {
	const countingApply = ( state: State, event: Event ) =>
		( { folded: [ ...state.folded, event._tag ] } );

	test( "folds a command's team events in order", () => {
		const acc = new Accumulator<State, BaseGameConfig, Event>( recordOf(), countingApply );

		acc.accumulate(
			TeamAssigned.make( { playerId: a, team: RED } ),
			TeamAssigned.make( { playerId: b, team: BLUE } ),
			SeatOrderSet.make( { order: [ a, b, c, d ] } ),
			CurrentPlayerSet.make( { playerId: b } )
		);

		expect( acc.work.context.teams ).toEqual( { [ a ]: RED, [ b ]: BLUE } );
		expect( acc.work.context.players ).toEqual( [ a, b, c, d ] );
		expect( acc.work.context.currentPlayer ).toBe( b );
		expect( acc.events ).toHaveLength( 4 );
	} );

	test( "applies each game event exactly once across successive calls", () => {
		const acc = new Accumulator<State, BaseGameConfig, Event>( recordOf(), countingApply );

		acc.accumulate( { _tag: "test/Counted" } );
		acc.accumulate( TeamAssigned.make( { playerId: a, team: RED } ) );
		acc.accumulate( { _tag: "test/Counted" } );

		// Three accumulate calls, two game events: the cumulative list must not be
		// re-reduced, or the first would have been applied three times over.
		expect( acc.work.state.folded ).toEqual( [ "test/Counted", "test/Counted" ] );
		expect( acc.events ).toHaveLength( 3 );
	} );
} );
