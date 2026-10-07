import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { getTableName } from "drizzle-orm";

import { Database } from "@/shared/utils/database";


/**
 * One statement the ledger issued, as the stub saw it.
 *
 * `table` is the drizzle table's own name, so a test asserts against `"games"`
 * rather than against an object identity it would have to import.
 */
export type LedgerCall = {
	readonly op: "insert" | "update" | "select" | "delete" | "transaction";
	readonly table: string;
	readonly values?: unknown;
};

/** What a test reads the ledger through. */
export type LedgerLog = {

	/** Every statement, in the order it was issued. */
	readonly calls: () => ReadonlyArray<LedgerCall>;

	/** The statements of one kind, optionally narrowed to one table. */
	readonly of: ( op: LedgerCall[ "op" ], table?: string ) => ReadonlyArray<LedgerCall>;

	/** The rows a table now holds, inserts and updates both applied. */
	readonly rows: ( table: string ) => ReadonlyArray<Record<string, unknown>>;

	/** Forgets everything. Rarely needed — each test builds its own stub. */
	readonly reset: () => void;
};

type Row = Record<string, unknown>;

type Chain = Effect.Effect<Array<Row>> & {
	values: ( v: unknown ) => Chain;
	set: ( v: Row ) => Chain;
	where: ( condition?: unknown ) => Chain;
	from: ( table: unknown ) => Chain;
	returning: ( ...args: ReadonlyArray<unknown> ) => Chain;
	onConflictDoNothing: ( ...args: ReadonlyArray<unknown> ) => Chain;
	onConflictDoUpdate: ( ...args: ReadonlyArray<unknown> ) => Chain;
	limit: ( n: number ) => Chain;
	orderBy: ( ...args: ReadonlyArray<unknown> ) => Chain;
};

const nameOf = ( table: unknown ) => {
	try {
		return getTableName( table as never );
	} catch {
		return "unknown";
	}
};

/**
 * Turns a drizzle `eq( column, value )` into a predicate over a stored row.
 *
 * Anything it cannot read matches everything, which is the safe direction here:
 * a test asserts on what was written, never on what was left alone.
 *
 * Reaches into `queryChunks`, which is drizzle's internal shape: a column, the
 * operator, then the bound parameter. That is a liberty a test stub can take
 * and production code could not — and it is worth taking, because without it
 * every `update … where` would hit every row, and the two transactions this
 * stub exists to support both read rows back and then update them one at a
 * time. Anything more complicated than one `eq` matches everything, which is
 * the safe direction: a test asserts on what was written, not on what was not.
 */
const matcherFor = ( condition: unknown ): ( ( row: Row ) => boolean ) => {
	const chunks = ( condition as { queryChunks?: ReadonlyArray<unknown> } )?.queryChunks;
	if ( !chunks ) {
		return () => true;
	}

	let column: string | undefined;
	let value: unknown;
	let columns = 0;
	let params = 0;

	for ( const chunk of chunks ) {
		const part = chunk as Row | undefined;
		if ( !part ) {
			continue;
		}

		// A column carries the table it belongs to; the operator between them is a
		// `StringChunk`, which also has a `value` and must not be read as the bound
		// parameter.
		if ( "table" in part && typeof part[ "name" ] === "string" ) {
			column = part[ "name" ] as string;
			columns++;
		} else if ( part.constructor?.name === "Param" ) {
			value = part[ "value" ];
			params++;
		}
	}

	if ( column === undefined || columns !== 1 || params !== 1 ) {
		return () => true;
	}

	// A condition names the *column* (`game_id`); a row is stored under the
	// property the ledger wrote it with (`gameId`). The stub bridges the two
	// rather than reaching further into drizzle for the mapping.
	const property = column.replace( /_([a-z])/g, ( _, letter: string ) => letter.toUpperCase() );
	return ( row ) => row[ column ] === value || row[ property ] === value;
};

/**
 * A stand-in for the one Drizzle handle the ledger writes through.
 *
 * The ledger (`src/swish/server/ledger.ts`) uses a small, closed slice of
 * Drizzle — `insert().values().returning()`, `update().set().where()`,
 * `select().from().where()` and `transaction( tx => Effect… )` — and every call
 * site pipes the builder straight into `Effect.orDie`. So each builder here has
 * to be an `Effect` *and* be chainable, which is why it is an `Effect.suspend`
 * with the builder methods assigned onto it.
 *
 * Rows are really stored, and updates are really applied. That matters more
 * than it sounds: `updateTeams` and `updateResults` each select the seats back
 * and then update them one at a time, and `updateResults` reads the `team` its
 * predecessor wrote in order to decide who was on the winning side. A stub that
 * only recorded statements could not tell that chain working from that chain
 * broken.
 *
 * @returns The stub's layer, and the log a test reads it through.
 */
export const makeTestDatabase = () => {
	const calls: Array<LedgerCall> = [];
	const tables = new Map<string, Array<Row>>();
	let sequence = 0;

	const rowsOf = ( table: string ) => {
		const existing = tables.get( table );
		if ( existing ) {
			return existing;
		}

		const fresh: Array<Row> = [];
		tables.set( table, fresh );
		return fresh;
	};

	const chain = () => {
		let op: LedgerCall[ "op" ] = "select";
		let table = "unknown";
		let assignment: Row = {};
		let inserted: Array<Row> = [];
		let matches: ( row: Row ) => boolean = () => true;

		const resolve = (): Array<Row> => {
			if ( op === "insert" ) {
				return inserted;
			}

			const rows = rowsOf( table ).filter( matches );
			if ( op === "update" ) {
				for ( const row of rows ) {
					Object.assign( row, assignment );
				}
			}

			return rows.map( row => ( { ...row } ) );
		};

		const self: Chain = Object.assign(
			Effect.suspend( () => Effect.succeed( resolve() ) ),
			{
				values: ( v: unknown ) => {
					// Rows are stamped with a key on the way in, because the ledger reads
					// one back and then updates by it.
					inserted = ( Array.isArray( v ) ? v : [ v ] ).map( ( row: Row ) => ( {
						id: `${ table }-${ ++sequence }`,
						...row
					} ) );

					rowsOf( table ).push( ...inserted );
					calls.push( { op: "insert", table, values: v } );
					return self;
				},
				set: ( v: Row ) => {
					assignment = v;
					calls.push( { op: "update", table, values: v } );
					return self;
				},
				where: ( condition?: unknown ) => {
					matches = matcherFor( condition );
					return self;
				},
				from: ( t: unknown ) => {
					table = nameOf( t );
					calls.push( { op: "select", table } );
					return self;
				},
				returning: () => self,
				onConflictDoNothing: () => self,
				onConflictDoUpdate: () => self,
				limit: () => self,
				orderBy: () => self
			}
		) as Chain;

		return {
			self,
			start: ( kind: LedgerCall[ "op" ], t?: unknown ) => {
				op = kind;
				if ( t !== undefined ) {
					table = nameOf( t );
				}

				return self;
			}
		};
	};

	const begin = ( kind: LedgerCall[ "op" ], table?: unknown ) => chain().start( kind, table );

	const handle = {
		insert: ( table: unknown ) => begin( "insert", table ),
		update: ( table: unknown ) => begin( "update", table ),
		delete: ( table: unknown ) => {
			calls.push( { op: "delete", table: nameOf( table ) } );
			return begin( "delete", table );
		},
		select: () => begin( "select" ),
		transaction: <A, E, R>( f: ( tx: unknown ) => Effect.Effect<A, E, R> ) => {
			calls.push( { op: "transaction", table: "" } );
			return f( handle );
		}
	};

	const log: LedgerLog = {
		calls: () => [ ...calls ],
		of: ( op, table ) => calls.filter(
			call => call.op === op && ( table === undefined || call.table === table )
		),
		rows: ( table ) => rowsOf( table ).map( row => ( { ...row } ) ),
		reset: () => {
			calls.length = 0;
			tables.clear();
			sequence = 0;
		}
	};

	const layer = Layer.succeed(
		Database,
		handle as unknown as Context.Service.Shape<typeof Database>
	);

	return { layer, log } as const;
};
