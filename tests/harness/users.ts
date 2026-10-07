import type { PlayerId, SwishUser } from "@/swish/schema";


/**
 * A seat at a test table, addressed by a name a test can read.
 *
 * `SwishUser.id` is a plain string and `PlayerId` is a branded `NonEmptyString`
 * with no further check, so the handle a test types — `"alice"` — is also the
 * id the engine stores. That is the whole point: an assertion reads
 * `view.context.currentPlayer === alice.id` rather than chasing a uuid.
 */
export type TestUser = SwishUser & { readonly id: PlayerId };

const make = ( name: string ): TestUser => ( {
	id: name as PlayerId,
	name: name.charAt( 0 ).toUpperCase() + name.slice( 1 ),
	avatar: `avatar://${ name }`
} );

/**
 * Builds one user per name, keyed by that name.
 *
 * @param names - The seat handles, in the order they will join.
 * @returns The users, addressable by handle.
 */
export const makeUsers = <const Names extends ReadonlyArray<string>>( names: Names ) => {
	const users = {} as { [K in Names[ number ]]: TestUser };
	for ( const name of names ) {
		users[ name as Names[ number ] ] = make( name );
	}

	return users;
};

/** The handles used by most tests, in join order. */
export const SEATS = [ "alice", "bob", "carol", "dave", "erin", "frank" ] as const;

/** Users for `SEATS`, ready to seat in order. */
export const seats = makeUsers( SEATS );

/** The first `count` seats, in join order. */
export const firstSeats = ( count: number ) =>
	SEATS.slice( 0, count ).map( name => seats[ name ] );
