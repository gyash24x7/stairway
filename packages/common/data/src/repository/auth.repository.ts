import { eq } from "drizzle-orm";
import type { Database } from "../client";
import type * as schema from "../schema/auth.schema";
import { users } from "../schema/auth.schema";

export class AuthRepository {

	constructor( private readonly db: Database<typeof schema> ) {}

	getUserById( id: string ) {
		return this.db.query.users.findFirst( {
			where: eq( users.id, id )
		} );
	}

	getUserByEmail( email: string ) {
		return this.db.query.users.findFirst( {
			where: eq( users.email, email )
		} );
	}

	async createUser( data: typeof users.$inferInsert ) {
		const [ newUser ] = await this.db.insert( users ).values( data ).returning();
		return newUser;
	}
}