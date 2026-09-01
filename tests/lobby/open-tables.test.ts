import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite";

import { openTableColumns, openTablesWhere } from "@/lobby/server/api.ts";
import { games } from "@/platform/database/schema.ts";

import type { GameStatus } from "@/swish/shared/schema.ts";

const MIGRATIONS = join( import.meta.dir, "..", "..", "migrations" );

/**
 * A real database, built by replaying the migrations that ship with the app.
 *
 * Not a hand-written `CREATE TABLE`: the point of running the query for real is
 * to catch a predicate that disagrees with the schema, and a schema written here
 * to suit the test would agree with it by construction. Replaying the migrations
 * also means this fails if the column the lobby reads is ever dropped or
 * renamed without the query following.
 */
const migrated = () => {
	const sqlite = new Database( ":memory:" );

	for ( const dir of readdirSync( MIGRATIONS ).sort() ) {
		const sql = readFileSync( join( MIGRATIONS, dir, "migration.sql" ), "utf-8" );

		for ( const statement of sql.split( "--> statement-breakpoint" ) ) {
			if ( statement.trim() ) {
				sqlite.run( statement );
			}
		}
	}

	return drizzle( { client: sqlite } );
};

const HOUR = 60 * 60 * 1000;
const now = 1_760_000_000_000;

/** Two hours back, the floor the handler applies. */
const since = new Date( now - 2 * HOUR );

type Seed = {
	readonly id: string;
	readonly game?: string;
	readonly status?: GameStatus;
	readonly isPrivate?: boolean;
	readonly seatsTaken?: number;
	readonly playerCount?: number;
	readonly ageMillis?: number;
};

const seed = ( db: SQLiteBunDatabase, rows: ReadonlyArray<Seed> ) => {
	for ( const row of rows ) {
		db.insert( games ).values( {
			id: row.id,
			code: row.id.toUpperCase().padEnd( 6, "X" ).slice( 0, 6 ),
			game: row.game ?? "tally",
			status: row.status ?? "CREATED",
			isPrivate: row.isPrivate ?? false,
			seatsTaken: row.seatsTaken ?? 1,
			playerCount: row.playerCount ?? 4,
			createdAt: new Date( now - ( row.ageMillis ?? 0 ) )
		} ).run();
	}
};

const openTables = ( db: SQLiteBunDatabase, game?: string ) =>
	db.select( openTableColumns )
		.from( games )
		.where( openTablesWhere( since, game ) )
		.orderBy( desc( games.createdAt ) )
		.all();

let db: SQLiteBunDatabase;

beforeEach( () => {
	db = migrated();
} );


describe( "the tables a lobby offers", () => {
	test( "a table with a free seat is offered", () => {
		seed( db, [ { id: "waiting", seatsTaken: 2, playerCount: 4 } ] );

		expect( openTables( db ).map( row => row.id ) ).toEqual( [ "waiting" ] );
	} );

	test( "a table that is full is not, even while it still reads CREATED", () => {
		// The autostart window: the last seat fills, the status stays CREATED, and a
		// timer starts the game a few seconds later. Offering it here would hand
		// every clicker a `GameFull`.
		seed( db, [
			{ id: "room", seatsTaken: 3, playerCount: 4 },
			{ id: "full", seatsTaken: 4, playerCount: 4 }
		] );

		expect( openTables( db ).map( row => row.id ) ).toEqual( [ "room" ] );
	} );

	test( "a table nobody has reported on yet is not offered", () => {
		// The row exists from the moment it is created, but its shape arrives over a
		// queue. Until it does the counts are 0 and 0, and `0 < 0` is false — so the
		// defaults fail closed rather than advertising a table of unknown size.
		seed( db, [ { id: "unreported", seatsTaken: 0, playerCount: 0 } ] );

		expect( openTables( db ) ).toHaveLength( 0 );
	} );

	test( "a table being played, or already over, is not offered", () => {
		seed( db, [
			{ id: "playing", status: "IN_PROGRESS", seatsTaken: 2 },
			{ id: "ready", status: "PLAYERS_READY", seatsTaken: 4 },
			{ id: "done", status: "COMPLETED", seatsTaken: 4 },
			{ id: "waiting" }
		] );

		expect( openTables( db ).map( row => row.id ) ).toEqual( [ "waiting" ] );
	} );

	test( "a private table is never offered, however joinable it is", () => {
		// It is otherwise indistinguishable from the open one beside it: same kind,
		// same free seat, same age. Only its creator's choice keeps it out.
		seed( db, [
			{ id: "public", isPrivate: false },
			{ id: "private", isPrivate: true }
		] );

		expect( openTables( db ).map( row => row.id ) ).toEqual( [ "public" ] );
		expect( openTables( db, "tally" ).map( row => row.id ) ).toEqual( [ "public" ] );
	} );

	test( "a table is public unless it was asked to be private", () => {
		// The column defaults to public, so a row written by anything that does not
		// know about visibility yet still behaves the way it always did.
		db.insert( games ).values( {
			id: "defaulted",
			code: "DEFALT",
			game: "tally",
			status: "CREATED",
			seatsTaken: 1,
			playerCount: 4,
			createdAt: new Date( now )
		} ).run();

		expect( openTables( db ).map( row => row.id ) ).toEqual( [ "defaulted" ] );
	} );

	test( "a table nobody ever joined stops being offered once it is stale", () => {
		// Nothing sweeps an abandoned CREATED row, so without the floor the lobby
		// would silt up with tables whose creators left long ago.
		seed( db, [
			{ id: "fresh", ageMillis: 30 * 60 * 1000 },
			{ id: "stale", ageMillis: 3 * HOUR }
		] );

		expect( openTables( db ).map( row => row.id ) ).toEqual( [ "fresh" ] );
	} );

	test( "the newest table is offered first", () => {
		seed( db, [
			{ id: "older", ageMillis: 40 * 60 * 1000 },
			{ id: "newest", ageMillis: 0 },
			{ id: "middle", ageMillis: 10 * 60 * 1000 }
		] );

		expect( openTables( db ).map( row => row.id ) ).toEqual( [ "newest", "middle", "older" ] );
	} );

	test( "asking for one kind answers with that kind alone", () => {
		seed( db, [
			{ id: "fish-1", game: "fish" },
			{ id: "tally-1", game: "tally" }
		] );

		expect( openTables( db, "fish" ).map( row => row.id ) ).toEqual( [ "fish-1" ] );
		expect( openTables( db ).map( row => row.id ).sort() ).toEqual( [ "fish-1", "tally-1" ] );
	} );

	test( "a row carries everything a lobby row needs to render", () => {
		seed( db, [ { id: "table", game: "fish", seatsTaken: 3, playerCount: 6 } ] );

		const [ row ] = openTables( db );

		expect( row ).toMatchObject( { id: "table", game: "fish", seatsTaken: 3, playerCount: 6 } );
		expect( row?.code ).toBe( "TABLEX" );
		expect( row?.createdAt.getTime() ).toBe( now );
	} );
} );
