import * as Schema from "effect/Schema";

import { assert, describe, it } from "@effect/vitest";

import type { BaseGameConfig, GameRecord, PlayerId, TeamId } from "@/swish/schema";
import {
	GameContext as Context,
	CurrentPlayerSet,
	GameCompleted,
	InteractionClosed,
	InteractionExpired,
	InteractionOpened,
	InteractionOption,
	InteractionPassed,
	InteractionResponded,
	PhaseEntered,
	PhaseExited,
	PlayerInfo,
	PlayerJoined,
	ResultsResolved,
	SeatOrderSet,
	StatusChanged,
	TeamAssigned,
	TeamLeft,
	TeamNamed,
	TurnAdvanced,
	TurnResumed,
	TurnSuspended
} from "@/swish/schema";
import { Accumulator, engineApply, foldEvents } from "@/swish/server/events";
import { activeFrame } from "@/swish/utils";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;
const ONE = "ONE" as TeamId;

const seat = ( id: PlayerId, isBot = false ) =>
	PlayerInfo.make( { id, name: id, avatar: `avatar://${ id }`, ...( isBot ? { isBot } : {} ) } );

type Counter = { count: number };

const Added = Schema.TaggedStruct( "test/ev/Added", { by: Schema.Int } );

const apply = ( state: Counter, event: { readonly _tag: string; readonly by: number } ) =>
	( { count: state.count + event.by } );

const record = (
	overrides: Partial<GameRecord<Counter, BaseGameConfig>> = {}
): GameRecord<Counter, BaseGameConfig> => ( {
	_tag: "swish/GameRecord",
	id: "game-1",
	version: 0,
	players: {},
	status: "CREATED",
	context: Context.make( {
		turn: 0,
		players: [],
		teams: {},
		teamNames: {},
		interactions: [],
		interactionCount: 0
	} ),
	config: { playerCount: 2, autoStart: true },
	state: { count: 0 },
	...overrides
} ) as GameRecord<Counter, BaseGameConfig>;

/** A record with a window already open, and its id. */
const opened = ( event = InteractionOpened.make( {
	kind: "claim",
	initiator: alice,
	responders: [ bob, carol ]
} ) ) => {
	const folded = engineApply( record(), event );
	return { record: folded, frameId: activeFrame( folded.context )!.id };
};


describe( "swish/server/events", () => {

	describe( "engineApply — the roster", () => {

		it( "seats a player and stamps the cursor on the first one", () => {
			// The cursor is set as the first seat is taken, not at `start`.
			const one = engineApply( record(), PlayerJoined.make( { player: seat( alice ) } ) );

			assert.deepStrictEqual( [ ...one.context.players ], [ alice ] );
			assert.strictEqual( one.context.currentPlayer, alice );
			assert.strictEqual( one.players[ alice ]?.name, "alice" );
		} );

		it( "leaves the cursor where it is for every later seat", () => {
			const one = engineApply( record(), PlayerJoined.make( { player: seat( alice ) } ) );
			const two = engineApply( one, PlayerJoined.make( { player: seat( bob ) } ) );

			assert.deepStrictEqual( [ ...two.context.players ], [ alice, bob ] );
			assert.strictEqual( two.context.currentPlayer, alice );
		} );

		it( "re-seats the table wholesale", () => {
			// What `start` does to a team game once the sides are interleaved.
			const one = engineApply( record(), PlayerJoined.make( { player: seat( alice ) } ) );
			const two = engineApply( one, PlayerJoined.make( { player: seat( bob ) } ) );
			const seated = engineApply( two, SeatOrderSet.make( { order: [ bob, alice ] } ) );

			assert.deepStrictEqual( [ ...seated.context.players ], [ bob, alice ] );
		} );
	} );

	describe( "engineApply — sides", () => {

		it( "puts a player on a side and takes them off again", () => {
			const joined = engineApply( record(), TeamAssigned.make( { playerId: alice, team: ONE } ) );
			assert.strictEqual( joined.context.teams[ alice ], ONE );

			const left = engineApply( joined, TeamLeft.make( { playerId: alice } ) );
			assert.isUndefined( left.context.teams[ alice ] );
		} );

		it( "names a side", () => {
			const named = engineApply( record(), TeamNamed.make( { team: ONE, name: "Reds" } ) );
			assert.strictEqual( named.context.teamNames[ ONE ], "Reds" );
		} );
	} );

	describe( "engineApply — the turn", () => {

		it( "moves the cursor and counts the turn separately", () => {
			const moved = engineApply( record(), CurrentPlayerSet.make( { playerId: bob } ) );
			assert.strictEqual( moved.context.currentPlayer, bob );
			assert.strictEqual( moved.context.turn, 0 );

			const counted = engineApply( moved, TurnAdvanced.make( {} ) );
			assert.strictEqual( counted.context.turn, 1 );
		} );

		it( "enters a phase, and leaves the phase alone on exit", () => {
			// `PhaseExited` is a marker in the log; entering the next one is what
			// actually moves the phase.
			const entered = engineApply( record(), PhaseEntered.make( { phase: "playing" } ) );
			assert.strictEqual( entered.context.phase, "playing" );

			const exited = engineApply( entered, PhaseExited.make( { phase: "playing" } ) );
			assert.strictEqual( exited.context.phase, "playing" );
		} );

		it( "suspends a turn and picks it back up", () => {
			const held = engineApply(
				record(),
				TurnSuspended.make( { actor: alice, moveType: "tax" } )
			);

			assert.strictEqual( held.context.suspended?.actor, alice );
			assert.strictEqual( held.context.suspended?.moveType, "tax" );

			const resumed = engineApply( held, TurnResumed.make( {} ) );
			assert.isUndefined( resumed.context.suspended );
		} );
	} );

	describe( "engineApply — status and results", () => {

		it( "moves the status", () => {
			const ready = engineApply( record(), StatusChanged.make( { status: "PLAYERS_READY" } ) );
			assert.strictEqual( ready.status, "PLAYERS_READY" );
		} );

		it( "completes the game without being told which status", () => {
			const done = engineApply( record(), GameCompleted.make( {} ) );
			assert.strictEqual( done.status, "COMPLETED" );
		} );

		it( "stamps the standings onto the record", () => {
			const results = {
				_tag: "swish/Standings" as const,
				ranking: [ { _tag: "swish/PlayerStanding" as const, playerId: alice, rank: 1 } ],
				winner: alice
			};

			const stamped = engineApply( record(), ResultsResolved.make( { results } ) );
			assert.strictEqual( stamped.results?.winner, alice );
		} );
	} );

	describe( "engineApply — windows", () => {

		it( "opens a window with every responder still pending", () => {
			const { record: open, frameId } = opened();
			const frame = activeFrame( open.context )!;

			assert.strictEqual( frame.id, frameId );
			assert.deepStrictEqual( [ ...frame.responders ], [ bob, carol ] );
			assert.deepStrictEqual( [ ...frame.pending ], [ bob, carol ] );
			assert.deepStrictEqual( [ ...frame.responses ], [] );
			assert.strictEqual( frame.openedAtTurn, 0 );
		} );

		it( "fills the defaults in for a window that named none", () => {
			const { record: open } = opened();
			const frame = activeFrame( open.context )!;

			assert.deepStrictEqual( [ ...frame.options ], [] );
			assert.strictEqual( frame.resolution, "first" );
			assert.isTrue( frame.allowPass );
			assert.isFalse( frame.secret );
			assert.isUndefined( frame.timeoutMillis );
		} );

		it( "keeps what a window did name", () => {
			const { record: open } = opened( InteractionOpened.make( {
				kind: "vote",
				initiator: alice,
				responders: [ bob ],
				options: [ InteractionOption.make( { move: "yes" } ) ],
				resolution: "all",
				allowPass: false,
				secret: true,
				timeoutMillis: 1_000
			} ) );

			const frame = activeFrame( open.context )!;
			assert.strictEqual( frame.resolution, "all" );
			assert.isFalse( frame.allowPass );
			assert.isTrue( frame.secret );
			assert.strictEqual( frame.timeoutMillis, 1_000 );
		} );

		it( "gives each window a fresh id, counted up", () => {
			const { record: first } = opened();
			const second = engineApply( first, InteractionOpened.make( {
				kind: "claim",
				initiator: bob,
				responders: [ alice ]
			} ) );

			assert.strictEqual( second.context.interactions.length, 2 );
			assert.strictEqual( second.context.interactionCount, 2 );
			assert.notStrictEqual(
				second.context.interactions[ 0 ]?.id,
				second.context.interactions[ 1 ]?.id
			);
		} );

		it( "settles a `first` window on the first answer", () => {
			// It is a race: once somebody has objected there is nothing for the rest
			// of the table to add, and asking anyway would leak how many others were
			// about to.
			const { record: open, frameId } = opened();
			const answered = engineApply( open, InteractionResponded.make( {
				frameId,
				playerId: bob,
				move: "challenge"
			} ) );

			const frame = activeFrame( answered.context )!;
			assert.deepStrictEqual( [ ...frame.pending ], [], "carol is never asked" );
			assert.deepStrictEqual(
				frame.responses.map( r => [ r.playerId, r.move, r.outcome ] ),
				[ [ bob, "challenge", "answered" ] ]
			);
		} );

		it( "takes only the answerer off an `all` window", () => {
			const { record: open, frameId } = opened( InteractionOpened.make( {
				kind: "vote",
				initiator: alice,
				responders: [ bob, carol ],
				resolution: "all"
			} ) );

			const answered = engineApply( open, InteractionResponded.make( {
				frameId,
				playerId: bob,
				move: "yes"
			} ) );

			assert.deepStrictEqual( [ ...activeFrame( answered.context )!.pending ], [ carol ] );
		} );

		it( "takes only the passer off, whatever the resolution", () => {
			// A pass is one seat's answer and never the table's: it leaves the
			// window open for everybody else.
			const { record: open, frameId } = opened();
			const passed = engineApply( open, InteractionPassed.make( { frameId, playerId: bob } ) );

			assert.deepStrictEqual( [ ...activeFrame( passed.context )!.pending ], [ carol ] );
		} );

		it( "records a pass and a timeout as their own outcomes", () => {
			const { record: open, frameId } = opened();
			const passed = engineApply( open, InteractionPassed.make( { frameId, playerId: bob } ) );
			const expired = engineApply(
				passed,
				InteractionExpired.make( { frameId, playerId: carol } )
			);

			const frame = activeFrame( expired.context )!;
			assert.deepStrictEqual( [ ...frame.pending ], [] );
			assert.deepStrictEqual(
				frame.responses.map( r => [ r.playerId, r.outcome ] ),
				[ [ bob, "passed" ], [ carol, "expired" ] ]
			);
			assert.isUndefined( frame.responses[ 0 ]?.move, "a pass names no move" );
		} );

		it( "closes a window by taking it off the stack", () => {
			const { record: open, frameId } = opened();
			const closed = engineApply( open, InteractionClosed.make( { frameId } ) );

			assert.deepStrictEqual( [ ...closed.context.interactions ], [] );
			assert.strictEqual( closed.context.interactionCount, 1, "the counter does not go back" );
		} );

		it( "closes only the window it names", () => {
			const { record: first, frameId } = opened();
			const stacked = engineApply( first, InteractionOpened.make( {
				kind: "blockClaim",
				initiator: bob,
				responders: [ alice ]
			} ) );

			const closed = engineApply( stacked, InteractionClosed.make( { frameId } ) );
			assert.strictEqual( closed.context.interactions.length, 1 );
			assert.strictEqual( activeFrame( closed.context )?.kind, "blockClaim" );
		} );

		it( "ignores an answer to a window that is not there", () => {
			const { record: open } = opened();
			const untouched = engineApply( open, InteractionResponded.make( {
				frameId: "nope",
				playerId: bob,
				move: "challenge"
			} ) );

			assert.deepStrictEqual( activeFrame( untouched.context )?.responses, [] );
		} );
	} );

	describe( "foldEvents", () => {

		it( "routes engine events to the header and game events to the state", () => {
			const folded = foldEvents(
				record(),
				[
					PlayerJoined.make( { player: seat( alice ) } ),
					Added.make( { by: 3 } ),
					TurnAdvanced.make( {} ),
					Added.make( { by: 4 } )
				] as never,
				apply as never
			);

			assert.strictEqual( ( folded.state as Counter ).count, 7 );
			assert.strictEqual( folded.context.turn, 1 );
			assert.deepStrictEqual( [ ...folded.context.players ], [ alice ] );
		} );

		it( "tells them apart by the `swish/ev/` prefix alone", () => {
			const folded = foldEvents( record(), [ Added.make( { by: 1 } ) ] as never, apply as never );
			assert.strictEqual( ( folded.state as Counter ).count, 1 );
		} );

		it( "folds nothing for an empty batch", () => {
			const before = record();
			assert.deepStrictEqual( foldEvents( before, [], apply as never ), before );
		} );

		it( "applies in order", () => {
			const folded = foldEvents(
				record(),
				[
					CurrentPlayerSet.make( { playerId: alice } ),
					CurrentPlayerSet.make( { playerId: bob } )
				] as never,
				apply as never
			);

			assert.strictEqual( folded.context.currentPlayer, bob );
		} );
	} );

	describe( "Accumulator", () => {

		it( "collects the events and folds them as they arrive", () => {
			const acc = new Accumulator( record(), apply as never );

			acc.accumulate( Added.make( { by: 2 } ) as never );
			acc.accumulate( TurnAdvanced.make( {} ), Added.make( { by: 3 } ) as never );

			assert.strictEqual( acc.events.length, 3 );
			assert.strictEqual( ( acc.work.state as Counter ).count, 5 );
			assert.strictEqual( acc.work.context.turn, 1 );
		} );

		it( "hands out a copy of its events, not the list itself", () => {
			const acc = new Accumulator( record(), apply as never );
			acc.accumulate( Added.make( { by: 1 } ) as never );

			const taken = acc.events;
			taken.push( Added.make( { by: 99 } ) as never );

			assert.strictEqual( acc.events.length, 1 );
		} );

		it( "exposes the game data a rule is handed", () => {
			const acc = new Accumulator( record(), apply as never );
			acc.accumulate( Added.make( { by: 4 } ) as never );

			const data = acc.getGameData();
			assert.deepStrictEqual( Object.keys( data ).sort(), [ "config", "context", "state" ] );
			assert.strictEqual( ( data.state as Counter ).count, 4 );
		} );

		it( "normalises an event on the way in, once", () => {
			// The engine uses this for one thing: a window a game opened with only
			// the bones of it, completed from the kind's declaration here so the log
			// holds windows that are complete in themselves.
			type Opened = typeof InteractionOpened.Type;
			const normalise = ( event: { readonly _tag: string } ) =>
				event._tag === "swish/ev/InteractionOpened"
					? InteractionOpened.make( {
						...( event as Opened ),
						options: [ InteractionOption.make( { move: "yes" } ) ],
						timeoutMillis: 5_000
					} )
					: event;

			const acc = new Accumulator( record(), apply as never, normalise as never );
			acc.accumulate( InteractionOpened.make( {
				kind: "open",
				initiator: alice,
				responders: [ bob ]
			} ) );

			// Both the recorded event and the folded frame carry the filled-in form.
			const recorded = acc.events[ 0 ] as {
				options: ReadonlyArray<unknown>;
				timeoutMillis: number;
			};
			assert.strictEqual( recorded.options.length, 1 );
			assert.strictEqual( recorded.timeoutMillis, 5_000 );
			assert.strictEqual( activeFrame( acc.work.context )?.timeoutMillis, 5_000 );
		} );

		it( "leaves an event the normaliser does not claim alone", () => {
			const acc = new Accumulator(
				record(),
				apply as never,
				( ( event: { readonly _tag: string } ) => event ) as never
			);

			acc.accumulate( Added.make( { by: 1 } ) as never );
			assert.strictEqual( ( acc.work.state as Counter ).count, 1 );
		} );
	} );
} );
