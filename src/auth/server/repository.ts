import * as schema from "@/auth/schema";
import type { Passkey, User } from "@/auth/types";
import { getDb } from "@/shared/db";
import { and, eq } from "drizzle-orm";

/**
 * Get a user by their username.
 * @param {string} username - The username of the user to retrieve.
 * @returns {Promise<User|undefined>} User object if found, otherwise undefined.
 */
export async function getUserByUsername( username: string ): Promise<User | undefined> {
	const db = getDb();
	return db.select().from( schema.users )
		.where( eq( schema.users.username, username ) )
		.then( ( [ user ] ) => user );
}

/**
 * Get a user by their ID.
 * @param {string} id - The ID of the user to retrieve.
 * @returns {Promise<User|undefined>} User object if found, otherwise undefined.
 */
export async function getUserById( id: string ): Promise<User | undefined> {
	const db = getDb();
	return db.select().from( schema.users )
		.where( eq( schema.users.id, id ) )
		.then( ( [ user ] ) => user );
}

/**
 * Get all passkeys for a user.
 * @param {string} userId - The ID of the user whose passkeys to retrieve.
 * @returns {Promise<Passkey[]>} Array of passkeys associated with the user.
 */
export async function getUserPasskeys( userId: string ): Promise<Passkey[]> {
	const db = getDb();
	return db.select().from( schema.passkeys )
		.where( eq( schema.passkeys.userId, userId ) );
}

/**
 * Get a specific passkey by its ID and user ID.
 * @param {string} id - The ID of the passkey to retrieve.
 * @param {string} userId - The ID of the user who owns the passkey.
 * @returns {Promise<Passkey|undefined>} Passkey object if found, otherwise undefined.
 */
export async function getPasskey( id: string, userId: string ): Promise<Passkey | undefined> {
	const db = getDb();
	return db.select().from( schema.passkeys )
		.where( and( eq( schema.passkeys.id, id ), eq( schema.passkeys.userId, userId ) ) )
		.then( ( [ passkey ] ) => passkey );
}

/**
 * Get or create a user by their username.
 * @param {typeof schema.users.$inferInsert} data - The user data containing username and name.
 * @returns {Promise<User>} Returns the user object if found or created.
 */
export async function getOrCreateUser( data: typeof schema.users.$inferInsert ): Promise<User> {
	return getUserByUsername( data.username ).then( user => user || createUser( data ) );
}

/**
 * Create a new user in the database.
 * @param {typeof schema.users.$inferInsert} data - The user data to insert.
 * @returns {Promise<User>} Returns the newly created user object.
 */
export async function createUser( data: typeof schema.users.$inferInsert ): Promise<User> {
	const db = getDb();
	return db.insert( schema.users ).values( data ).returning().then( ( [ newUser ] ) => newUser );
}

/**
 * Create a new passkey for a user.
 * @param {typeof schema.passkeys.$inferInsert} data - The passkey data to insert.
 * @returns {Promise<Passkey>} Returns the newly created passkey object.
 */
export async function createPasskey( data: typeof schema.passkeys.$inferInsert ): Promise<Passkey> {
	const db = getDb();
	return db.insert( schema.passkeys ).values( data ).returning().then( ( [ newPasskey ] ) => newPasskey );
}

/**
 * Update the counter for a passkey.
 * @param {Pick<Passkey, "id" | "userId" | "counter">} data - The passkey data containing id, userId, and new counter value.
 * @returns {Promise<Passkey|undefined>} Returns the updated passkey object if successful, otherwise undefined.
 */
export async function updatePasskeyCounter( data: Pick<Passkey, "id" | "userId" | "counter"> ): Promise<Passkey | undefined> {
	const db = getDb();
	return db.update( schema.passkeys )
		.set( { counter: data.counter } )
		.where( and( eq( schema.passkeys.id, data.id ), eq( schema.passkeys.userId, data.userId ) ) )
		.returning()
		.then( ( [ updatedPasskey ] ) => updatedPasskey );
}