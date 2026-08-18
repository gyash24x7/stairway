import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { commitsIn, createInput, runGame } from "@tests/helpers/runner.ts";
import type { ScribeConfig, ScribeState } from "@tests/helpers/games/scribe.ts";
import { scribeEngine } from "@tests/helpers/games/scribe.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d ] = [ "a", "b", "c", "d" ].map( player );
const seats = [ a, b, c, d ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const config: ScribeConfig = { playerCount: 4, autoStart: false, allowSpecial: false };

/** How many commits a checkpoint covers, mirroring the Durable Object adapter. */
const CHECKPOINT_INTERVAL = 32;

type StoredRecord = {
	readonly version: number;
	readonly state: ScribeState;
	readonly seed: string
};
type StoredCheckpoint = { readonly commitId: string; readonly data: StoredRecord };

/**
 * Seats a table and lays down `notes` further commits on it. `note` never ends
 * a turn, so one seat can grow the log as long as a test needs.
 *
 * @param notes - How many notes to write past the start.
 * @returns The backing store, for a test to inspect or carry on playing against.
 */
const logOf = ( notes: number ) => {
	const cells = new Map<string, unknown>();

	runGame( scribeEngine, engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( config ) );
		yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
		yield* engine.start( a );
		yield* Effect.forEach(
			Array.from( { length: notes }, ( _, index ) => index ),
			index => engine.note( { text: `n${ index }` }, a )
		);
	} ), { cells } );

	return cells;
};

/** Reads the game back out of a store a previous run left behind. */
const reread = ( cells: Map<string, unknown> ) =>
	runGame( scribeEngine, engine => engine.getState(), { cells } );

/** Reads it back expecting to fail, which is how corruption surfaces. */
const rereadFailing = ( cells: Map<string, unknown> ) =>
	runGame( scribeEngine, engine => engine.getState().pipe( Effect.flip ), { cells } );

/**
 * Puts the materialized record out of step with the cursor, which is the only
 * thing that makes `load` rebuild rather than trust what it read.
 */
const forceRefold = ( cells: Map<string, unknown> ) => {
	const record = cells.get( "data" ) as StoredRecord;
	cells.set( "data", { ...record, version: record.version + 5 } );
};

/** Rewrites the genesis record's state, so a fold from it is recognisable. */
const poisonBase = ( cells: Map<string, unknown> ) => {
	const base = cells.get( "log:base" ) as StoredRecord;
	cells.set( "log:base", { ...base, state: { ...base.state, log: [ "POISON" ] } } );
};


describe( "the shape of a fresh log", () => {
	test( "the base and the record start as one value, above an empty history", () => {
		const cells = logOf( 0 );
		const fresh = new Map<string, unknown>();

		runGame( scribeEngine, engine => engine.initialize( createInput( config ) ), {
			cells: fresh
		} );

		expect( fresh.get( "log:count" ) ).toBe( 0 );
		expect( fresh.get( "log:cursor" ) ).toBe( -1 );
		expect( fresh.get( "log:base" ) ).toEqual( fresh.get( "data" ) );
		// And the base is never rewritten once the game moves on.
		expect( cells.get( "log:base" ) ).not.toEqual( cells.get( "data" ) );
	} );

	test( "the record round-trips raw, seed and all", () => {
		const cells = logOf( 1 );
		const record = cells.get( "data" ) as StoredRecord;

		// Nothing crossing this boundary is schema-encoded, so the stored value is
		// the record itself rather than its wire form — seed included, which is the
		// one field the wire form does not carry.
		expect( record.seed ).toBeString();
		expect( record.version ).toBeNumber();
	} );
} );


describe( "the version and the cursor", () => {
	test( "the version is always one more than the cursor", () => {
		const cells = new Map<string, unknown>();

		const { result } = runGame( scribeEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config ) );

			const versions: Array<[ number, number ]> = [];
			const record = () => Effect.gen( function* () {
				const view = yield* engine.getState();
				versions.push( [ view.version, cells.get( "log:cursor" ) as number ] );
			} );

			yield* record();
			for ( const id of seats ) {
				yield* engine.join( info( id ) );
				yield* record();
			}

			yield* engine.start( a );
			yield* record();
			yield* engine.note( { text: "one" }, a );
			yield* record();

			return versions;
		} ), { cells } );

		for ( const [ version, cursor ] of result ) {
			expect( version ).toBe( cursor + 1 );
		}
	} );

	test( "one command is one commit", () => {
		const cells = logOf( 3 );

		// Four joins, the start, and three notes.
		expect( cells.get( "log:count" ) ).toBe( 8 );
		expect( commitsIn( cells ) ).toHaveLength( 8 );
	} );
} );


describe( "checkpoints", () => {
	test( "one lands every interval, stamped with the commit it folds through", () => {
		const cells = logOf( 40 );
		const index = CHECKPOINT_INTERVAL - 1;
		const checkpoint = cells.get( `log:ckpt:${ index }` ) as StoredCheckpoint;

		expect( checkpoint ).toBeDefined();
		expect( checkpoint.commitId ).toBe( commitsIn( cells )[ index ]!.id );
		expect( checkpoint.data.version ).toBe( index + 1 );
	} );

	test( "none is written before the interval is reached", () => {
		const cells = logOf( 5 );

		expect( cells.get( `log:ckpt:${ CHECKPOINT_INTERVAL - 1 }` ) ).toBeUndefined();
	} );

	test( "a rebuild folds from the checkpoint rather than from the base", () => {
		const cells = logOf( 40 );

		poisonBase( cells );
		forceRefold( cells );

		// A fold that had started at the base would carry the poison forward.
		expect( reread( cells ).result.view.log ).not.toContain( "POISON" );
	} );

	test( "a checkpoint belonging to a dead history is skipped", () => {
		const cells = logOf( 40 );
		const index = CHECKPOINT_INTERVAL - 1;
		const checkpoint = cells.get( `log:ckpt:${ index }` ) as StoredCheckpoint;

		// The commit at that position no longer matches the one the checkpoint was
		// taken at, so it belongs to a history that was forked away.
		cells.set( `log:ckpt:${ index }`, { ...checkpoint, commitId: "some-other-commit" } );
		poisonBase( cells );
		forceRefold( cells );

		expect( reread( cells ).result.view.log ).toContain( "POISON" );
	} );

	test( "a rebuild with no checkpoint at all starts from the base", () => {
		const cells = logOf( 5 );

		poisonBase( cells );
		forceRefold( cells );

		expect( reread( cells ).result.view.log ).toContain( "POISON" );
	} );
} );


describe( "healing a record that drifted", () => {
	test( "a version that disagrees with the cursor is rebuilt from the log", () => {
		const cells = logOf( 3 );
		const before = reread( cells ).result;

		forceRefold( cells );
		const healed = reread( cells ).result;

		expect( healed.version ).toBe( before.version );
		expect( healed.view ).toEqual( before.view );
	} );

	test( "the healed record is written back, so the next read is trusted", () => {
		const cells = logOf( 3 );

		forceRefold( cells );
		reread( cells );

		const record = cells.get( "data" ) as StoredRecord;

		expect( record.version ).toBe( cells.get( "log:cursor" ) as number + 1 );
	} );

	test( "a record that agrees with the cursor is trusted as it stands", () => {
		const cells = logOf( 3 );
		const record = cells.get( "data" ) as StoredRecord;

		// Tampering with the state alone leaves the version agreeing with the
		// cursor, so nothing rebuilds and the tampered value comes straight back.
		cells.set( "data", { ...record, state: { ...record.state, log: [ "TRUSTED" ] } } );

		expect( reread( cells ).result.view.log ).toEqual( [ "TRUSTED" ] );
	} );
} );


describe( "a log that cannot be read", () => {
	test( "a missing base is corruption", () => {
		const cells = logOf( 3 );

		cells.delete( "log:base" );
		forceRefold( cells );

		const failure = rereadFailing( cells ).result;

		expect( failure._tag ).toBe( "swish/CorruptState" );
		expect( ( failure as { reason: string } ).reason ).toBe( "Base not set!" );
	} );

	test( "a hole below the cursor is corruption, and names the commit", () => {
		const cells = logOf( 5 );

		cells.delete( "log:commit:6" );
		forceRefold( cells );

		const failure = rereadFailing( cells ).result;

		expect( failure._tag ).toBe( "swish/CorruptState" );
		expect( ( failure as { reason: string } ).reason ).toContain( "Commit 6 is missing" );
	} );

	test( "a hole the rebuild never reaches is not corruption", () => {
		// The checkpoint at 31 is what the fold starts from, so a commit below it
		// is never read — and the record still rebuilds cleanly.
		const cells = logOf( 40 );

		cells.delete( "log:commit:6" );
		forceRefold( cells );

		expect( reread( cells ).result.status ).toBe( "IN_PROGRESS" );
	} );

	test( "a game that was never written is not found", () => {
		const failure = rereadFailing( new Map() ).result;

		expect( failure._tag ).toBe( "swish/GameNotFound" );
	} );
} );
