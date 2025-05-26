import * as schema from "@/auth/schema";
import { getDb } from "@/shared/db";
import { and, eq } from "drizzle-orm";

export async function getUserByUsername( username: string ) {
	const db = await getDb();
	const [ user ] = await db.select().from( schema.users ).where( eq( schema.users.username, username ) );
	return user;
}

export async function getUserPasskeys( userId: string ) {
	const db = await getDb();
	return db.select().from( schema.passkeys ).where( eq( schema.passkeys.userId, userId ) );
}

export async function getPasskey( id: string, userId: string ) {
	const db = await getDb();
	const [ passkey ] = await db.select()
		.from( schema.passkeys )
		.where( and( eq( schema.passkeys.id, id ), eq( schema.passkeys.userId, userId ) ) );
	return passkey;
}

export async function createUser( data: typeof schema.users.$inferInsert ) {
	const db = await getDb();
	const [ newUser ] = await db.insert( schema.users ).values( data ).returning();
	return newUser;
}

export async function createPasskey( data: typeof schema.passkeys.$inferInsert ) {
	const db = await getDb();
	const [ newPasskey ] = await db.insert( schema.passkeys ).values( data ).returning();
	return newPasskey;
}