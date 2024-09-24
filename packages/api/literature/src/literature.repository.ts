import { Injectable } from "@nestjs/common";
import { PostgresClientFactory } from "@shared/api";
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
			with: { players: true, teams: true }
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

	async getCardMappingForCard( gameId: string, cardId: string ) {
		return this.db.query.cardMappings.findFirst( {
			where: and(
				eq( schema.cardMappings.gameId, gameId ),
				eq( schema.cardMappings.cardId, cardId )
			)
		} );
	}

	async getCardMappingsForCards( gameId: string, cardIds: string[] ) {
		return this.db.query.cardMappings.findMany( {
			where: and(
				eq( schema.cardMappings.gameId, gameId ),
				inArray( schema.cardMappings.cardId, cardIds )
			)
		} );
	}

	async getCardLocationsForPlayer( gameId: string, playerId: string ) {
		return this.db.select().from( schema.cardLocations )
			.where( and(
				eq( schema.cardLocations.gameId, gameId ),
				eq( schema.cardLocations.playerId, playerId )
			) )
			.orderBy( desc( schema.cardLocations.weight ) );
	}

	async getCardLocationsForCard( gameId: string, cardId: string ) {
		return this.db.select().from( schema.cardLocations )
			.where( and(
				eq( schema.cardLocations.gameId, gameId ),
				eq( schema.cardLocations.cardId, cardId )
			) )
			.orderBy( desc( schema.cardLocations.weight ) );
	}

	async getAskMoves( gameId: string ) {
		return this.db.select().from( schema.asks )
			.where( eq( schema.asks.gameId, gameId ) )
			.orderBy( desc( schema.asks.timestamp ) );
	}

	async getAskMove( moveId: string ) {
		return this.db.query.asks.findFirst( { where: eq( schema.asks.id, moveId ) } );
	}

	async getCallMoves( gameId: string ) {
		return this.db.query.calls.findMany( { where: eq( schema.calls.gameId, gameId ) } );
	}
	
	async getCallMove( moveId: string ) {
		return this.db.query.calls.findFirst( { where: eq( schema.calls.id, moveId ) } );
	}

	async getTransferMoves( gameId: string ) {
		return this.db.query.transfers.findMany( { where: eq( schema.transfers.gameId, gameId ) } );
	}

	async getTransferMove( moveId: string ) {
		return this.db.query.transfers.findFirst( { where: eq( schema.transfers.id, moveId ) } );
	}

	async createCardMappings( input: typeof schema.cardMappings.$inferInsert[] ) {
		return this.db.insert( schema.cardMappings ).values( input ).returning();
	}

	async createAsk( input: typeof schema.asks.$inferInsert ) {
		const [ ask ] = await this.db.insert( schema.asks ).values( input ).returning();
		return ask;
	}

	async createCall( input: typeof schema.calls.$inferInsert ) {
		const [ call ] = await this.db.insert( schema.calls ).values( input ).returning();
		return call;
	}

	async createTransfer( input: typeof schema.transfers.$inferInsert ) {
		const [ transfer ] = await this.db.insert( schema.transfers ).values( input ).returning();
		return transfer;
	}

	async updateGameStatus( gameId: string, status: GameStatus ) {
		await this.db.update( schema.games ).set( { status } ).where( eq( schema.games.id, gameId ) );
	}

	async updateCurrentTurn( gameId: string, currentTurn: string ) {
		await this.db.update( schema.games ).set( { currentTurn } ).where( eq( schema.games.id, gameId ) );
	}

	async updateLastMove( gameId: string, lastMoveId: string ) {
		await this.db.update( schema.games ).set( { lastMoveId } ).where( eq( schema.games.id, gameId ) );
	}

	async updateCardMapping( cardId: string, gameId: string, playerId: string ) {
		await this.db.update( schema.cardMappings )
			.set( { playerId } )
			.where( and(
				eq( schema.cardMappings.gameId, gameId ),
				eq( schema.cardMappings.cardId, cardId )
			) );
	}

	async deleteCardMappings( gameId: string, cardIds: string[] ) {
		await this.db.delete( schema.cardMappings )
			.where( and(
				eq( schema.cardMappings.gameId, gameId ),
				inArray( schema.cardMappings.cardId, cardIds )
			) );
	}

	async updateTeamScore( teamId: string, score: number, setsWon: string[] ) {
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

	async createCardLocations( input: typeof schema.cardLocations.$inferInsert[] ) {
		await this.db.insert( schema.cardLocations ).values( input ).returning();
	}

	async deleteCardLocationForCards( gameId: string, cardIds: string[] ) {
		await this.db.delete( schema.cardLocations ).where(
			and(
				eq( schema.cardLocations.gameId, gameId ),
				inArray( schema.cardLocations.cardId, cardIds )
			)
		);
	}

	async updateCardLocations( inputs: typeof schema.cardLocations.$inferInsert[] ) {
		await Promise.all(
			inputs.map( input =>
				this.db.update( schema.cardLocations ).set( input ).where(
					and(
						eq( schema.cardLocations.gameId, input.gameId ),
						eq( schema.cardLocations.playerId, input.playerId ),
						eq( schema.cardLocations.cardId, input.cardId )
					)
				)
			)
		);
	}
}

