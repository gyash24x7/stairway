import type { CardSet } from "@common/cards";
import { PostgresClientFactory } from "@common/core";
import {
	and,
	cardLocations,
	cardMappings,
	createLiteratureDrizzleClient,
	desc,
	eq,
	games,
	type GameStatus,
	inArray,
	type LiteratureDrizzleClient,
	moves,
	players,
	teams
} from "@literature/data";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DatabaseService {

	private db: LiteratureDrizzleClient;

	constructor( readonly postgresClientFactory: PostgresClientFactory ) {
		const postgresClient = postgresClientFactory.get();
		this.db = createLiteratureDrizzleClient( postgresClient );
	}

	async getGameById( id: string ) {
		return this.db.query.literatureGames.findFirst( {
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
		return this.db!.query.literatureGames.findFirst( {
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

	async getCardMappingsForGame( gameId: string ) {
		return this.db.query.literatureCardMappings.findMany( { where: eq( cardMappings.gameId, gameId ) } );
	}

	async getCardMappingsForPlayer( gameId: string, playerId: string ) {
		return this.db.query.literatureCardMappings.findMany( {
			where: and(
				eq( cardMappings.gameId, gameId ),
				eq( cardMappings.playerId, playerId )
			)
		} );
	}

	async createCardMappings( input: typeof cardMappings.$inferInsert[] ) {
		return this.db.insert( cardMappings ).values( input ).returning();
	}

	async createMove( input: typeof moves.$inferInsert ) {
		const [ move ] = await this.db.insert( moves ).values( input ).returning();
		return move;
	}

	async updateGameStatus( gameId: string, status: GameStatus ) {
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

	async updateTeamScore( teamId: string, score: number, setsWon: CardSet[] ) {
		await this.db.update( teams ).set( { score, setsWon } ).where( eq( teams.id, teamId ) );
	}

	async assignTeamsToPlayers( teamData: Record<string, typeof teams.$inferSelect> ) {
		await Promise.all(
			Object.keys( teamData ).map( teamId => {
				const playerIds = teamData[ teamId ].memberIds;
				return this.db.update( players ).set( { teamId } ).where( inArray( players.id, playerIds ) );
			} )
		);
	}

	async getCardLocationsForPlayer( gameId: string, playerId: string ) {
		return this.db.select().from( cardLocations )
			.where( and(
				eq( cardLocations.gameId, gameId ),
				eq( cardLocations.playerId, playerId )
			) )
			.orderBy( desc( cardLocations.weight ) );
	}

	async getCardLocationsForGame( gameId: string ) {
		return this.db.select().from( cardLocations )
			.where( eq( cardLocations.gameId, gameId ) )
			.orderBy( desc( cardLocations.weight ) );
	}

	async createCardLocations( input: typeof cardLocations.$inferInsert[] ) {
		await this.db.insert( cardLocations ).values( input ).returning();
	}

	async deleteCardLocationForPlayer( gameId: string, playerId: string, cardId: string ) {
		await this.db.delete( cardLocations ).where(
			and(
				eq( cardLocations.gameId, gameId ),
				eq( cardLocations.playerId, playerId ),
				eq( cardLocations.cardId, cardId )
			)
		);
	}

	async deleteCardLocationForCards( gameId: string, cardIds: string[] ) {
		await this.db.delete( cardLocations ).where(
			and(
				eq( cardLocations.gameId, gameId ),
				inArray( cardLocations.cardId, cardIds )
			)
		);
	}

	async updateCardLocationForPlayer( input: typeof cardLocations.$inferInsert ) {
		await this.db.update( cardLocations ).set( input ).where(
			and(
				eq( cardLocations.gameId, input.gameId ),
				eq( cardLocations.playerId, input.playerId ),
				eq( cardLocations.cardId, input.cardId )
			)
		);
	}
}

