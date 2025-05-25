import * as schema from "@/literature/schema";
import type { Literature } from "@/literature/types";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

const db = drizzle( "", { schema } );

export async function getGameById( id: string ) {
	return db.query.games.findFirst( {
		where: eq( schema.games.id, id ),
		with: { players: true, teams: true }
	} );
}

export async function getGameByCode( code: string ) {
	return db!.query.games.findFirst( {
		where: eq( schema.games.code, code ),
		with: { players: true }
	} );
}

export async function createGame( input: typeof schema.games.$inferInsert ) {
	const [ game ] = await db.insert( schema.games ).values( input ).returning();
	return game;
}

export async function createPlayer( input: typeof schema.players.$inferInsert ) {
	const [ player ] = await db.insert( schema.players ).values( input ).returning();
	return player;
}

export async function createTeams( input: typeof schema.teams.$inferInsert[] ) {
	return db.insert( schema.teams ).values( input ).returning();
}

export async function getCardMappingsForGame( gameId: string ) {
	return db.query.cardMappings.findMany( { where: eq( schema.cardMappings.gameId, gameId ) } );
}

export async function getCardMappingsForPlayer( gameId: string, playerId: string ) {
	return db.query.cardMappings.findMany( {
		where: and(
			eq( schema.cardMappings.gameId, gameId ),
			eq( schema.cardMappings.playerId, playerId )
		)
	} );
}

export async function getCardMappingForCard( gameId: string, cardId: string ) {
	return db.query.cardMappings.findFirst( {
		where: and(
			eq( schema.cardMappings.gameId, gameId ),
			eq( schema.cardMappings.cardId, cardId )
		)
	} );
}

export async function getCardMappingsForCards( gameId: string, cardIds: string[] ) {
	return db.query.cardMappings.findMany( {
		where: and(
			eq( schema.cardMappings.gameId, gameId ),
			inArray( schema.cardMappings.cardId, cardIds )
		)
	} );
}

export async function getCardLocationsForPlayer( gameId: string, playerId: string ) {
	return db.select().from( schema.cardLocations )
		.where( and(
			eq( schema.cardLocations.gameId, gameId ),
			eq( schema.cardLocations.playerId, playerId )
		) )
		.orderBy( desc( schema.cardLocations.weight ) );
}

export async function getCardLocationsForCard( gameId: string, cardId: string ) {
	return db.select().from( schema.cardLocations )
		.where( and(
			eq( schema.cardLocations.gameId, gameId ),
			eq( schema.cardLocations.cardId, cardId )
		) )
		.orderBy( desc( schema.cardLocations.weight ) );
}

export async function getAskMoves( gameId: string ) {
	return db.select().from( schema.asks )
		.where( eq( schema.asks.gameId, gameId ) )
		.orderBy( desc( schema.asks.timestamp ) );
}

export async function getAskMove( moveId: string ) {
	return db.query.asks.findFirst( { where: eq( schema.asks.id, moveId ) } );
}

export async function getCallMoves( gameId: string ) {
	return db.query.calls.findMany( { where: eq( schema.calls.gameId, gameId ) } );
}

export async function getCallMove( moveId: string ) {
	return db.query.calls.findFirst( { where: eq( schema.calls.id, moveId ) } );
}

export async function getTransferMoves( gameId: string ) {
	return db.query.transfers.findMany( { where: eq( schema.transfers.gameId, gameId ) } );
}

export async function getTransferMove( moveId: string ) {
	return db.query.transfers.findFirst( { where: eq( schema.transfers.id, moveId ) } );
}

export async function createCardMappings( input: typeof schema.cardMappings.$inferInsert[] ) {
	return db.insert( schema.cardMappings ).values( input ).returning();
}

export async function createAsk( input: typeof schema.asks.$inferInsert ) {
	const [ ask ] = await db.insert( schema.asks ).values( input ).returning();
	return ask;
}

export async function createCall( input: typeof schema.calls.$inferInsert ) {
	const [ call ] = await db.insert( schema.calls ).values( input ).returning();
	return call;
}

export async function createTransfer( input: typeof schema.transfers.$inferInsert ) {
	const [ transfer ] = await db.insert( schema.transfers ).values( input ).returning();
	return transfer;
}

export async function updateGameStatus( gameId: string, status: Literature.GameStatus ) {
	await db.update( schema.games ).set( { status } ).where( eq( schema.games.id, gameId ) );
}

export async function updateCurrentTurn( gameId: string, currentTurn: string ) {
	await db.update( schema.games ).set( { currentTurn } ).where( eq( schema.games.id, gameId ) );
}

export async function updateLastMove( gameId: string, lastMoveId: string ) {
	await db.update( schema.games ).set( { lastMoveId } ).where( eq( schema.games.id, gameId ) );
}

export async function updateCardMapping( cardId: string, gameId: string, playerId: string ) {
	await db.update( schema.cardMappings )
		.set( { playerId } )
		.where( and(
			eq( schema.cardMappings.gameId, gameId ),
			eq( schema.cardMappings.cardId, cardId )
		) );
}

export async function deleteCardMappings( gameId: string, cardIds: string[] ) {
	await db.delete( schema.cardMappings )
		.where( and(
			eq( schema.cardMappings.gameId, gameId ),
			inArray( schema.cardMappings.cardId, cardIds )
		) );
}

export async function updateTeamScore( teamId: string, score: number, setsWon: string ) {
	await db.update( schema.teams ).set( { score, setsWon } ).where( eq( schema.teams.id, teamId ) );
}

export async function assignTeamsToPlayers( teamData: Record<string, typeof schema.teams.$inferSelect> ) {
	await Promise.all(
		Object.keys( teamData ).map( teamId => {
			const playerIds = teamData[ teamId ].memberIds;
			return db.update( schema.players )
				.set( { teamId } )
				.where( ilike( schema.players.userId, playerIds ) );
		} )
	);
}

export async function createCardLocations( input: typeof schema.cardLocations.$inferInsert[] ) {
	await db.insert( schema.cardLocations ).values( input ).returning();
}

export async function deleteCardLocationForCards( gameId: string, cardIds: string[] ) {
	await db.delete( schema.cardLocations ).where(
		and(
			eq( schema.cardLocations.gameId, gameId ),
			inArray( schema.cardLocations.cardId, cardIds )
		)
	);
}

export async function updateCardLocations( inputs: typeof schema.cardLocations.$inferInsert[] ) {
	await Promise.all(
		inputs.map( input =>
			db.update( schema.cardLocations ).set( input ).where(
				and(
					eq( schema.cardLocations.gameId, input.gameId ),
					eq( schema.cardLocations.playerId, input.playerId ),
					eq( schema.cardLocations.cardId, input.cardId )
				)
			)
		)
	);
}