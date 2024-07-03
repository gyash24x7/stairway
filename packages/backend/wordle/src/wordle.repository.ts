import { PostgresClientFactory } from "@backend/utils";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./wordle.schema.ts";

@Injectable()
export class WordleRepository {

	private db: PostgresJsDatabase<typeof schema>;

	constructor( readonly postgresClientFactory: PostgresClientFactory ) {
		const postgresClient = postgresClientFactory.get();
		this.db = drizzle( postgresClient, { schema } );
	}

	async getGameById( id: string ) {
		return this.db.query.games.findFirst( {
			where: eq( schema.games.id, id )
		} );
	}

	async createGame( input: typeof schema.games.$inferInsert ) {
		const [ game ] = await this.db.insert( schema.games ).values( input ).returning();
		return game;
	}

	async updateGame( gameId: string, guesses: string[], completedWords: string[] ) {
		return this.db.update( schema.games )
			.set( { guesses, completedWords } )
			.where( eq( schema.games.id, gameId ) )
			.returning();
	}
}

