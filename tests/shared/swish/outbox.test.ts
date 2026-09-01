import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { OutboxConsumerLive } from "@/swish/server/outbox.ts";
import { SwishArchive, SwishDatabase } from "@/swish/server/services.ts";
import { GameId, PlayerId, TeamId } from "@/swish/shared/schema.ts";

import type { GameAddress, LedgerEntry, TableProjection } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b ] = [ player( "a" ), player( "b" ) ];

const address = { game: "tally", id: GameId.make( "game-1" ) };

/** One `recordResults` call, as the database received it. */
type Recorded = {
	readonly address: GameAddress;
	readonly entries: ReadonlyArray<LedgerEntry>;
	readonly completedAt: number;
};

/** One `syncStatus` call, as the database received it. */
type Synced = {
	readonly address: GameAddress;
	readonly projection: TableProjection;
};

/**
 * The two stores the consumer writes to, each recording what it was handed and
 * the order it was handed it in. `writes` is shared between them on purpose:
 * the consumer's contract is that the archive lands before the result does, and
 * one ordered list is what makes that assertable.
 */
const stores = () => {
	const filed = new Map<string, unknown>();
	const recorded: Array<Recorded> = [];
	const synced: Array<Synced> = [];
	const writes: Array<"archive" | "ledger" | "status"> = [];

	const archive = Layer.succeed( SwishArchive, SwishArchive.of( {
		save: ( at, encoded ) => Effect.sync( () => {
			writes.push( "archive" );
			filed.set( `${ at.game }:${ at.id }`, encoded );
		} ),
		load: <T>() => Effect.succeed( Option.none<T>() )
	} ) );

	// Only `recordResults` is reachable from the consumer; the rest belong to the
	// HTTP handlers and dying is the honest stub for them.
	const unreachable = () => Effect.die( "not reachable from the outbox consumer" );

	const database = Layer.succeed( SwishDatabase, SwishDatabase.of( {
		findGame: unreachable,
		findGameByCode: unreachable,
		findRematch: unreachable,
		createGame: unreachable,
		claimRematch: unreachable,
		seatPlayers: unreachable,
		findCleanableGames: unreachable,
		markCleanedUp: unreachable,
		recordResults: ( at, entries, completedAt ) => Effect.sync( () => {
			writes.push( "ledger" );
			recorded.push( { address: at, entries, completedAt } );
		} ),
		syncStatus: ( at, projection ) => Effect.sync( () => {
			writes.push( "status" );
			synced.push( { address: at, projection } );
		} )
	} ) );

	return { filed, recorded, synced, writes, layer: Layer.mergeAll( archive, database ) };
};

/**
 * Runs one raw message through the consumer against those stores.
 *
 * @param body - The message body, exactly as it comes off the queue.
 * @returns The stores, plus the consumer's exit so a test can assert on failure.
 */
const consume = ( body: unknown ) => {
	const { layer, ...collected } = stores();

	const exit = Effect.runSyncExit(
		Effect.gen( function* () {
			const closeOutGame = yield* OutboxConsumerLive;
			return yield* closeOutGame( body );
		} ).pipe( Effect.provide( layer ) )
	);

	return { ...collected, exit };
};

const entry = ( playerId: PlayerId, rank: number, winner: boolean ) =>
	( { playerId, rank, score: rank === 1 ? 9 : 4, winner } );

const completion = ( overrides: Record<string, unknown> = {} ) => ( {
	_tag: "swish/msg/GameCompleted",
	address,
	completedAt: 1_700_000_000_000,
	entries: [ entry( b, 1, true ), entry( a, 2, false ) ],
	archive: { id: "game-1", status: "COMPLETED", view: { points: {} } },
	version: 12,
	status: "COMPLETED",
	seatsTaken: 2,
	playerCount: 2,
	...overrides
} );

const statusChange = ( overrides: Record<string, unknown> = {} ) => ( {
	_tag: "swish/msg/TableStatusChanged",
	address,
	version: 3,
	status: "CREATED",
	seatsTaken: 1,
	playerCount: 4,
	...overrides
} );


describe( "the outbox consumer", () => {
	test( "files the archive under the game and id the message names", () => {
		const { filed } = consume( completion() );

		expect( [ ...filed.keys() ] ).toEqual( [ "tally:game-1" ] );
		expect( filed.get( "tally:game-1" ) )
			.toEqual( { id: "game-1", status: "COMPLETED", view: { points: {} } } );
	} );

	test( "records the lines the message carries, against the same game", () => {
		const { recorded } = consume( completion() );

		expect( recorded ).toHaveLength( 1 );
		expect( recorded[ 0 ]?.address ).toEqual( address );
		expect( recorded[ 0 ]?.entries.map( line => line.playerId ) ).toEqual( [ b, a ] );
		expect( recorded[ 0 ]?.entries.find( line => line.winner )?.playerId ).toBe( b );
	} );

	test( "stamps the completion from the message, not from a clock of its own", () => {
		// The queue is at-least-once and may deliver late, so the reading has to be
		// the one the table took when the game ended.
		const { recorded } = consume( completion( { completedAt: 1_600_000_000_000 } ) );

		expect( recorded[ 0 ]?.completedAt ).toBe( 1_600_000_000_000 );
	} );

	test( "files the archive, then the lines, then the status", () => {
		// The status write is what sends a reader to the archive, so it goes last:
		// flipping it first would point readers at an archive that is not there yet.
		const { writes } = consume( completion() );

		expect( writes ).toEqual( [ "archive", "ledger", "status" ] );
	} );

	test( "a game that ranked nobody is still filed, and still marked over", () => {
		// No lines to write, so the ledger is skipped entirely — but the game is
		// still over, and the status write is what says so.
		const { filed, recorded, synced, writes } = consume( completion( { entries: [] } ) );

		expect( filed.size ).toBe( 1 );
		expect( recorded[ 0 ]?.entries ).toEqual( [] );
		expect( synced[ 0 ]?.projection.status ).toBe( "COMPLETED" );
		expect( writes ).toEqual( [ "archive", "ledger", "status" ] );
	} );

	test( "carries a line's side through to the store", () => {
		const red = TeamId.make( "red" );
		const { recorded } = consume( completion( {
			entries: [ { playerId: a, rank: 1, team: red, winner: true } ]
		} ) );

		expect( recorded[ 0 ]?.entries[ 0 ] ).toMatchObject( { team: red, winner: true } );
	} );

	test( "a message of neither kind is refused, and nothing is written", () => {
		const { filed, recorded, synced, exit } = consume( { address, archive: {} } );

		expect( exit._tag ).toBe( "Failure" );
		expect( filed.size ).toBe( 0 );
		expect( recorded ).toHaveLength( 0 );
		expect( synced ).toHaveLength( 0 );
	} );

	test( "an untagged completion is refused — the tag is what routes it", () => {
		const { _tag, ...untagged } = completion();
		const { filed, exit } = consume( untagged );

		expect( exit._tag ).toBe( "Failure" );
		expect( filed.size ).toBe( 0 );
	} );

	test( "a status change writes the status alone, filing nothing", () => {
		const { filed, recorded, synced, writes } = consume( statusChange() );

		expect( writes ).toEqual( [ "status" ] );
		expect( filed.size ).toBe( 0 );
		expect( recorded ).toHaveLength( 0 );
		expect( synced[ 0 ]?.address ).toEqual( address );
		expect( synced[ 0 ]?.projection ).toEqual( {
			version: 3,
			status: "CREATED",
			seatsTaken: 1,
			playerCount: 4
		} );
	} );

	test( "a status change carries the version the store guards on", () => {
		const { synced } = consume( statusChange( { version: 41, status: "IN_PROGRESS" } ) );

		expect( synced[ 0 ]?.projection.version ).toBe( 41 );
		expect( synced[ 0 ]?.projection.status ).toBe( "IN_PROGRESS" );
	} );

	test( "a status change missing its version is refused", () => {
		// The version is the whole ordering guarantee; a message without one could
		// only be applied blind.
		const { version, ...noVersion } = statusChange();
		const { synced, exit } = consume( noVersion );

		expect( exit._tag ).toBe( "Failure" );
		expect( synced ).toHaveLength( 0 );
	} );

	test( "a completion naming no game is refused rather than filed under an empty key", () => {
		const { filed, exit } = consume( completion( { address: { game: "", id: "game-1" } } ) );

		expect( exit._tag ).toBe( "Failure" );
		expect( filed.size ).toBe( 0 );
	} );
} );
