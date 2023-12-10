import { eq } from "drizzle-orm";
import type { Database } from "../client";
import type * as schema from "../schema/literature.schema";
import { games, players } from "../schema/literature.schema";

export class LiteratureRepository {

	constructor( private readonly db: Database<typeof schema> ) {}

	async getGameById( id: string ) {
		return this.db.query.games.findFirst( {
			where: eq( games.id, id ),
			with: {
				players: true,
				moves: true
			}
		} );
	}

	async getGameByCode( code: string ) {
		return this.db.query.games.findFirst( {
			where: eq( games.code, code ),
			with: { players: true }
		} );
	}

	async createGame( input: typeof games.$inferInsert ) {
		const [ game ] = await this.db.insert( games ).values( input ).returning();
		return game;
	}

	async createPlayer( input: typeof players.$inferInsert ) {
		const [ player ] = await this.db.insert( players ).values( input ).returning();
		return player;
	}
}