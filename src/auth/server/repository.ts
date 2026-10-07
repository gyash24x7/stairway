import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { eq } from "drizzle-orm";

import type { PasskeyId, UserId } from "@/auth/schema";
import { User } from "@/auth/schema";
import type { PasskeyRow, UserRow } from "@/auth/server/tables";
import { passkeys, users } from "@/auth/server/tables";
import { Database } from "@/shared/utils/database";


// --- Auth Repository ---------------------------------------------

/**
 * The six queries auth actually makes, each named for what it is for.
 *
 * Every one of them dies rather than failing: there is no handler that can do
 * anything useful about the database being unreachable, and they all used to be
 * `.pipe( Effect.orDie )` at the call site anyway.
 */
export class AuthRepository extends Context.Service<AuthRepository, {
	readonly findUserByUsername: ( username: string ) => Effect.Effect<Option.Option<User>>;
	readonly findUserById: ( id: UserId ) => Effect.Effect<Option.Option<User>>;
	readonly createUser: ( data: Omit<UserRow, "id"> ) => Effect.Effect<User>;
	readonly findPasskeyByCredentialId: ( credentialId: string ) => Effect.Effect<Option.Option<PasskeyRow>>;
	readonly createPasskey: ( data: typeof passkeys.$inferInsert ) => Effect.Effect<void>;
	readonly updatePasskeyCounter: ( id: PasskeyId, counter: number ) => Effect.Effect<void>;
}>()( "auth/Repository" ) {}

export const AuthRepositoryLive = Layer.effect( AuthRepository, Effect.gen( function* () {
	const db = yield* Database;
	const decodeUser = Schema.decodeUnknownEffect( User );
	const toUser = ( row: UserRow ) => decodeUser( row ).pipe( Effect.orDie );

	const firstUser = ( rows: ReadonlyArray<UserRow> ) => Option.match(
		Option.fromUndefinedOr( rows[ 0 ] ),
		{
			onNone: () => Effect.succeed( Option.none<User>() ),
			onSome: row => Effect.map( toUser( row ), Option.some )
		}
	);

	return AuthRepository.of( {
		findUserByUsername: Effect.fn( function* ( username ) {
			const rows = yield* db.select().from( users )
				.where( eq( users.username, username ) )
				.limit( 1 )
				.pipe( Effect.orDie );

			return yield* firstUser( rows );
		} ),

		findUserById: Effect.fn( function* ( id ) {
			const rows = yield* db.select().from( users )
				.where( eq( users.id, id ) )
				.limit( 1 )
				.pipe( Effect.orDie );

			return yield* firstUser( rows );
		} ),

		createUser: Effect.fn( function* ( data ) {
			const rows = yield* db.insert( users ).values( data ).returning().pipe( Effect.orDie );
			return yield* toUser( rows[ 0 ]! );
		} ),

		findPasskeyByCredentialId: Effect.fn( function* ( credentialId ) {
			const rows = yield* db.select().from( passkeys )
				.where( eq( passkeys.credentialId, credentialId ) )
				.limit( 1 )
				.pipe( Effect.orDie );

			return Option.fromUndefinedOr( rows[ 0 ] );
		} ),

		createPasskey: Effect.fn( function* ( data ) {
			yield* db.insert( passkeys ).values( data ).pipe( Effect.orDie );
		} ),

		updatePasskeyCounter: Effect.fn( function* ( id, counter ) {
			const updated = yield* db.update( passkeys ).set( { counter } )
				.where( eq( passkeys.id, id ) )
				.returning( { id: passkeys.id } )
				.pipe( Effect.orDie );

			if ( updated.length === 0 ) {
				return yield* Effect.die( `auth: no passkey with id ${ id }` );
			}
		} )
	} );
} ) );
