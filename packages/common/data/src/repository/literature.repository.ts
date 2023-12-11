import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import type * as schema from "../schema/literature.schema";
import { cardMappings, games, moves, players, teams } from "../schema/literature.schema";

export class LiteratureRepository {

	constructor( private readonly db: Database<typeof schema> ) {}

	async getGameById( id: string ) {
		return this.db.query.games.findFirst( {
			where: eq( games.id, id ),
			with: {
				players: true,
				moves: {
					limit: 5,
					orderBy: ( moves, { desc } ) => [ desc( moves.timestamp ) ]
				},
				cardMappings: true,
				teams: true
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

	async createTeams( input: typeof teams.$inferInsert[] ) {
		return this.db.insert( teams ).values( input ).returning();
	}

	async getCardMappings( gameId: string, playerId?: string ) {
		let sql = eq( cardMappings.gameId, gameId );

		if ( !!playerId ) {
			sql = and( sql, eq( cardMappings.playerId, playerId ) )!;
		}

		return this.db.query.cardMappings.findMany( { where: sql } );
	}

	async createCardMappings( input: typeof cardMappings.$inferInsert[] ) {
		return this.db.insert( cardMappings ).values( input ).returning();
	}

	async createMove( input: typeof moves.$inferInsert ) {
		const [ move ] = await this.db.insert( moves ).values( input ).returning();
		return move;
	}

	async updateGameStatus(
		gameId: string,
		status: "CREATED" | "PLAYERS_READY" | "TEAMS_CREATED" | "IN_PROGRESS" | "COMPLETED"
	) {
		await this.db.update( games ).set( { status } ).where( eq( games.id, gameId ) );
	}

	async updateCurrentTurn( gameId: string, currentTurn: string ) {
		await this.db.update( games ).set( { currentTurn } ).where( eq( games.id, gameId ) );
	}

	async updateCardMapping( cardId: string, gameId: string, playerId: string ) {
		await this.db.update( cardMappings )
			.set( { playerId } )
			.where( and( eq( cardMappings.gameId, gameId ), eq( cardMappings.cardId, cardId ) ) );
	}

	async deleteCardMappings( cardIds: string[], gameId: string ) {
		await this.db.delete( cardMappings )
			.where( and( eq( cardMappings.gameId, gameId ), inArray( cardMappings.cardId, cardIds ) ) );
	}

	async updateTeamScore( teamId: string, score: number ) {
		await this.db.update( teams ).set( { score } ).where( eq( teams.id, teamId ) );
	}
}