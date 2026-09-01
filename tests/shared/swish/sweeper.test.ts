import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SwishDatabase } from "@/swish/server/services.ts";
import { GameSweeper, SWEEP_BATCH_SIZE } from "@/swish/server/sweeper.ts";
import { GameAddress, GameId } from "@/swish/shared/schema.ts";

import type { GameCleaner } from "@/swish/server/sweeper.ts";

const at = ( game: string, id: string ) =>
	GameAddress.make( { game, id: GameId.make( id ) } );

/** The ids a pass is expected to have marked, branded the way it reports them. */
const ids = ( ...names: ReadonlyArray<string> ) => names.map( name => GameId.make( name ) );

/**
 * The database the pass reads and writes, recording both sides of it: which
 * limit it asked for, and which ids it ticked. `writes` is shared with the
 * cleaners so the order the two happened in is assertable — the pass's whole
 * failure story is that the object is emptied before the row is marked.
 */
const stores = ( pending: ReadonlyArray<GameAddress> ) => {
	const asked: Array<number> = [];
	const marked: Array<ReadonlyArray<GameId>> = [];
	const writes: Array<string> = [];

	// Only the two sweep methods are reachable from here; the rest belong to the
	// HTTP handlers and the outbox, and dying is the honest stub for them.
	const unreachable = () => Effect.die( "not reachable from the sweeper" );

	const layer = Layer.succeed( SwishDatabase, SwishDatabase.of( {
		findGame: unreachable,
		findGameByCode: unreachable,
		findRematch: unreachable,
		createGame: unreachable,
		claimRematch: unreachable,
		seatPlayers: unreachable,
		recordResults: unreachable,
		syncStatus: unreachable,
		findCleanableGames: limit => Effect.sync( () => {
			asked.push( limit );
			return pending.slice( 0, limit );
		} ),
		markCleanedUp: ids => Effect.sync( () => {
			writes.push( `mark:${ ids.join( "," ) }` );
			marked.push( ids );
		} )
	} ) );

	return { asked, marked, writes, layer };
};

/** A cleaner that records the tables it emptied. */
const cleaner = ( writes: Array<string>, game: string ) =>
	( id: GameId ) => Effect.sync( () => void writes.push( `clear:${ game }:${ id }` ) );

/** A cleaner whose object refuses, the way an unreachable one would. */
const failing = ( game: string ) =>
	( id: GameId ) => Effect.die( `${ game }:${ id } is unreachable` );

/**
 * The cleaners as the pass asks for them: a lookup by game kind, answering
 * `undefined` for one it has no namespace bound for.
 */
const lookup = ( cleaners: Readonly<Record<string, GameCleaner>> ) =>
	( game: string ) => cleaners[ game ];

/**
 * Runs one pass over those games with those cleaners.
 *
 * @param pending - What the database reports as cleanable.
 * @param build - The cleaners, given the shared write log to record into.
 * @returns What the stores saw, plus the count the pass returned.
 */
const sweep = (
	pending: ReadonlyArray<GameAddress>,
	build: ( writes: Array<string> ) => ( game: string ) => GameCleaner | undefined
) => {
	const { layer, ...collected } = stores( pending );

	const cleared = Effect.runSync(
		Effect.gen( function* () {
			const pass = yield* GameSweeper( build( collected.writes ) );
			return yield* pass;
		} ).pipe( Effect.provide( layer ) )
	);

	return { ...collected, cleared };
};

const both = ( writes: Array<string> ) => lookup( {
	tictactoe: cleaner( writes, "tictactoe" ),
	wordle: cleaner( writes, "wordle" )
} );


describe( "the game sweeper", () => {
	test( "empties the object of every game the database hands it", () => {
		const { writes, cleared } = sweep(
			[ at( "tictactoe", "g1" ), at( "wordle", "g2" ) ],
			both
		);

		expect( cleared ).toBe( 2 );
		expect( writes.filter( write => write.startsWith( "clear:" ) ) )
			.toEqual( [ "clear:tictactoe:g1", "clear:wordle:g2" ] );
	} );

	test( "reaches each game through its own namespace, not the first one bound", () => {
		const { writes } = sweep( [ at( "wordle", "g1" ) ], both );

		expect( writes ).toContain( "clear:wordle:g1" );
		expect( writes ).not.toContain( "clear:tictactoe:g1" );
	} );

	test( "marks the batch in one write rather than one per game", () => {
		const { marked } = sweep(
			[ at( "tictactoe", "g1" ), at( "tictactoe", "g2" ), at( "wordle", "g3" ) ],
			both
		);

		expect( marked ).toHaveLength( 1 );
		expect( marked[ 0 ] ).toEqual( ids( "g1", "g2", "g3" ) );
	} );

	test( "empties every object before it marks any row", () => {
		// A pass that clears and then fails to mark is repeated harmlessly; one
		// that marks and then fails to clear strands the storage forever.
		const { writes } = sweep(
			[ at( "tictactoe", "g1" ), at( "wordle", "g2" ) ],
			both
		);

		expect( writes ).toEqual( [ "clear:tictactoe:g1", "clear:wordle:g2", "mark:g1,g2" ] );
	} );

	test( "a game whose object refuses is left unmarked, and the batch continues", () => {
		const { marked, cleared, writes } = sweep(
			[ at( "tictactoe", "g1" ), at( "wordle", "g2" ), at( "tictactoe", "g3" ) ],
			writeLog => lookup( {
				tictactoe: cleaner( writeLog, "tictactoe" ),
				wordle: failing( "wordle" )
			} )
		);

		expect( cleared ).toBe( 2 );
		expect( marked[ 0 ] ).toEqual( ids( "g1", "g3" ) );
		expect( writes ).toContain( "clear:tictactoe:g3" );
	} );

	test( "a game with no namespace bound is skipped rather than marked", () => {
		// A game pulled out of the worker before its tables were swept keeps them,
		// rather than being ticked off as done by a pass that could not reach it.
		const { marked, cleared } = sweep(
			[ at( "retired", "g1" ), at( "wordle", "g2" ) ],
			both
		);

		expect( cleared ).toBe( 1 );
		expect( marked[ 0 ] ).toEqual( ids( "g2" ) );
	} );

	test( "asks for a bounded batch rather than the whole backlog", () => {
		const { asked } = sweep( [ at( "wordle", "g1" ) ], both );

		expect( asked ).toEqual( [ SWEEP_BATCH_SIZE ] );
	} );

	test( "nothing to sweep marks nothing and clears nothing", () => {
		const { writes, marked, cleared } = sweep( [], both );

		expect( cleared ).toBe( 0 );
		expect( writes ).toEqual( [ "mark:" ] );
		expect( marked[ 0 ] ).toEqual( [] );
	} );
} );
