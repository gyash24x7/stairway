import { PostgresClientFactory } from "@backend/utils";
import type { CardSet } from "@common/cards";
import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./literature.schema.ts";
import type { GameStatus } from "./literature.types.ts";

@Injectable()
export class LiteratureRepository {

	private db: PostgresJsDatabase<typeof schema>;

	constructor( readonly postgresClientFactory: PostgresClientFactory ) {
		const postgresClient = postgresClientFactory.get();
		this.db = drizzle( postgresClient, { schema } );
	}

	async getGameById( id: string ) {
		return this.db.query.games.findFirst( {
			where: eq( schema.games.id, id ),
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
		return this.db!.query.games.findFirst( {
			where: eq( schema.games.code, code ),
			with: { players: true }
		} );
	}

	async createGame( input: typeof schema.games.$inferInsert ) {
		const [ game ] = await this.db.insert( schema.games ).values( input ).returning();
		return game;
	}

	async createPlayer( input: typeof schema.players.$inferInsert ) {
		const [ player ] = await this.db.insert( schema.players ).values( input ).returning();
		return player;
	}

	async createTeams( input: typeof schema.teams.$inferInsert[] ) {
		return this.db.insert( schema.teams ).values( input ).returning();
	}

	async getCardMappingsForGame( gameId: string ) {
		return this.db.query.cardMappings.findMany( { where: eq( schema.cardMappings.gameId, gameId ) } );
	}

	async getCardMappingsForPlayer( gameId: string, playerId: string ) {
		return this.db.query.cardMappings.findMany( {
			where: and(
				eq( schema.cardMappings.gameId, gameId ),
				eq( schema.cardMappings.playerId, playerId )
			)
		} );
	}

	async createCardMappings( input: typeof schema.cardMappings.$inferInsert[] ) {
		return this.db.insert( schema.cardMappings ).values( input ).returning();
	}

	async createMove( input: typeof schema.moves.$inferInsert ) {
		const [ move ] = await this.db.insert( schema.moves ).values( input ).returning();
		return move;
	}

	async updateGameStatus( gameId: string, status: GameStatus ) {
		await this.db.update( schema.games ).set( { status } ).where( eq( schema.games.id, gameId ) );
	}

	async updateCurrentTurn( gameId: string, currentTurn: string ) {
		await this.db.update( schema.games ).set( { currentTurn } ).where( eq( schema.games.id, gameId ) );
	}

	async updateCardMapping( cardId: string, gameId: string, playerId: string ) {
		await this.db.update( schema.cardMappings )
			.set( { playerId } )
			.where( and(
				eq( schema.cardMappings.gameId, gameId ),
				eq( schema.cardMappings.cardId, cardId )
			) );
	}

	async deleteCardMappings( cardIds: string[], gameId: string ) {
		await this.db.delete( schema.cardMappings )
			.where( and(
				eq( schema.cardMappings.gameId, gameId ),
				inArray( schema.cardMappings.cardId, cardIds )
			) );
	}

	async updateTeamScore( teamId: string, score: number, setsWon: CardSet[] ) {
		await this.db.update( schema.teams ).set( { score, setsWon } ).where( eq( schema.teams.id, teamId ) );
	}

	async assignTeamsToPlayers( teamData: Record<string, typeof schema.teams.$inferSelect> ) {
		await Promise.all(
			Object.keys( teamData ).map( teamId => {
				const playerIds = teamData[ teamId ].memberIds;
				return this.db.update( schema.players )
					.set( { teamId } )
					.where( inArray( schema.players.id, playerIds ) );
			} )
		);
	}

	async getCardLocationsForPlayer( gameId: string, playerId: string ) {
		return this.db.select().from( schema.cardLocations )
			.where( and(
				eq( schema.cardLocations.gameId, gameId ),
				eq( schema.cardLocations.playerId, playerId )
			) )
			.orderBy( desc( schema.cardLocations.weight ) );
	}

	async getCardLocationsForGame( gameId: string ) {
		return this.db.select().from( schema.cardLocations )
			.where( eq( schema.cardLocations.gameId, gameId ) )
			.orderBy( desc( schema.cardLocations.weight ) );
	}

	async createCardLocations( input: typeof schema.cardLocations.$inferInsert[] ) {
		await this.db.insert( schema.cardLocations ).values( input ).returning();
	}

	async deleteCardLocationForPlayer( gameId: string, playerId: string, cardId: string ) {
		await this.db.delete( schema.cardLocations ).where(
			and(
				eq( schema.cardLocations.gameId, gameId ),
				eq( schema.cardLocations.playerId, playerId ),
				eq( schema.cardLocations.cardId, cardId )
			)
		);
	}

	async deleteCardLocationForCards( gameId: string, cardIds: string[] ) {
		await this.db.delete( schema.cardLocations ).where(
			and(
				eq( schema.cardLocations.gameId, gameId ),
				inArray( schema.cardLocations.cardId, cardIds )
			)
		);
	}

	async updateCardLocationForPlayer( input: typeof schema.cardLocations.$inferInsert ) {
		await this.db.update( schema.cardLocations ).set( input ).where(
			and(
				eq( schema.cardLocations.gameId, input.gameId ),
				eq( schema.cardLocations.playerId, input.playerId ),
				eq( schema.cardLocations.cardId, input.cardId )
			)
		);
	}
}

