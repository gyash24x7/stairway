import { PostgresClientFactory } from "@backend/utils";
import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./auth.schema.ts";

@Injectable()
export class AuthRepository {

	private db: PostgresJsDatabase<typeof schema>;

	constructor( readonly postgresClientFactory: PostgresClientFactory ) {
		const postgresClient = postgresClientFactory.get();
		this.db = drizzle( postgresClient, { schema } );
	}

	async getUser( id: string ) {
		return this.db.query.users.findFirst( { where: eq( schema.users.id, id ) } );
	}

	async createUser( { name, email, password: rawPassword }: Omit<typeof schema.users.$inferInsert, "salt"> ) {
		const salt = await bcrypt.genSalt( 15 );
		const password = await bcrypt.hash( rawPassword, salt );

		const [ newUser ] = await this.db.insert( schema.users )
			.values( { name, email, password, salt } )
			.returning();

		return newUser;
	}

	async getUserByEmail( email: string ) {
		return this.db.query.users.findFirst( { where: eq( schema.users.email, email ) } );
	}

	async verifyUser( id: string ) {
		const [ updatedUser ] = await this.db.update( schema.users )
			.set( { verified: true } )
			.where( eq( schema.users.id, id ) )
			.returning();

		return updatedUser;
	}

	async getTokenByIdAndCode( id: string, code: string ) {
		return this.db.query.tokens.findFirst( {
			where: and( eq( schema.tokens.id, id ), eq( schema.tokens.code, code ) )
		} );
	}

	async createToken( id: string ) {
		const [ token ] = await this.db.insert( schema.tokens ).values( { id } ).returning();
		return token;
	}

	async deleteToken( id: string ) {
		const [ deletedToken ] = await this.db.delete( schema.tokens )
			.where( eq( schema.tokens.id, id ) )
			.returning();

		return deletedToken;
	}
}