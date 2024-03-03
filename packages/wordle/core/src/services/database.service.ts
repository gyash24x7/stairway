import { PostgresClientFactory } from "@common/core";
import { Injectable } from "@nestjs/common";
import { createWordleDrizzleClient, eq, games, type WordleDrizzleClient } from "@wordle/data";

@Injectable()
export class DatabaseService {

	private db: WordleDrizzleClient;

	constructor( readonly postgresClientFactory: PostgresClientFactory ) {
		const postgresClient = postgresClientFactory.get();
		this.db = createWordleDrizzleClient( postgresClient );
	}

	async getGameById( id: string ) {
		return this.db.query.wordleGames.findFirst( {
			where: eq( games.id, id )
		} );
	}

	async createGame( input: typeof games.$inferInsert ) {
		const [ game ] = await this.db.insert( games ).values( input ).returning();
		return game;
	}

	async updateGame( gameId: string, guesses: string[], completedWords: string[] ) {
		return this.db.update( games ).set( { guesses, completedWords } ).where( eq( games.id, gameId ) ).returning();
	}
}

