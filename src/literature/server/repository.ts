import * as authSchema from "@/auth/schema";
import * as schema from "@/literature/schema";
import type { Literature } from "@/literature/types";
import { getDb } from "@/shared/db";
import { and, desc, eq, inArray } from "drizzle-orm";

export async function getGameById( id: string ) {
	const db = await getDb();
	const [ game ] = await db.select().from( schema.games ).where( eq( schema.games.id, id ) ).limit( 1 );
	const players = await db.select().from( schema.players )
		.where( eq( schema.players.gameId, id ) );

	const teams = await db.select().from( schema.teams ).where( eq( schema.teams.gameId, id ) );

	return {
		...game,
		players: players.reduce(
			( acc, player ) => {
				acc[ player.id ] = player;
				return acc;
			},
			{} as Literature.PlayerData
		),
		teams: teams.reduce(
			( acc, team ) => {
				acc[ team.id ] = team;
				return acc;
			},
			{} as Record<string, Literature.Team>
		)
	};
}

export async function getGameByCode( code: string ) {
	const db = await getDb();
	const [ game ] = await db.select().from( schema.games ).where( eq( schema.games.code, code ) ).limit( 1 );
	const players = await db.select().from( schema.players ).where( eq( schema.players.gameId, game.id ) );
	return { ...game, players };
}

export async function createGame( input: typeof schema.games.$inferInsert ) {
	const db = await getDb();
	console.log( input );
	const [ game ] = await db.insert( schema.games ).values( input ).returning();
	return game;
}

export async function createPlayer( input: typeof schema.players.$inferInsert ) {
	const db = await getDb();
	const [ player ] = await db.insert( schema.players ).values( input ).returning();
	return player;
}

export async function createBot( gameId: string ) {
	const db = await getDb();
	const botUser = {
		id: `bot-${ gameId }-${ Date.now() }`,
		name: `Bot ${ Date.now() }`,
		username: `bot-${ gameId }-${ Date.now() }`,
		avatar: "https://example.com/bot-avatar.png" // Placeholder avatar URL
	};

	await db.insert( authSchema.users ).values( botUser );

	const [ player ] = await db.insert( schema.players )
		.values( { id: botUser.id, gameId, isBot: 1 } )
		.returning();

	return player;
}

export async function createTeams( input: typeof schema.teams.$inferInsert[] ) {
	const db = await getDb();
	return db.insert( schema.teams ).values( input ).returning();
}

export async function getCardMappingsForGame( gameId: string ) {
	const db = await getDb();
	return db.select().from( schema.cardMappings ).where( eq( schema.cardMappings.gameId, gameId ) );
}

export async function getCardMappingsForPlayer( gameId: string, playerId: string ) {
	const db = await getDb();
	return db.select().from( schema.cardMappings )
		.where( and(
			eq( schema.cardMappings.gameId, gameId ),
			eq( schema.cardMappings.playerId, playerId )
		) );
}

export async function getCardMappingForCard( gameId: string, cardId: string ) {
	const db = await getDb();
	const [ cardMapping ] = await db.select().from( schema.cardMappings )
		.where( and(
			eq( schema.cardMappings.gameId, gameId ),
			eq( schema.cardMappings.cardId, cardId )
		) )
		.limit( 1 );

	return cardMapping;
}

export async function getCardMappingsForCards( gameId: string, cardIds: string[] ) {
	const db = await getDb();
	return db.select().from( schema.cardMappings )
		.where( and(
			eq( schema.cardMappings.gameId, gameId ),
			inArray( schema.cardMappings.cardId, cardIds )
		) );
}

export async function getCardLocationsForPlayer( gameId: string, playerId: string ) {
	const db = await getDb();
	return db.select().from( schema.cardLocations )
		.where( and(
			eq( schema.cardLocations.gameId, gameId ),
			eq( schema.cardLocations.playerId, playerId )
		) )
		.orderBy( desc( schema.cardLocations.weight ) );
}

export async function getCardLocationsForCard( gameId: string, cardId: string ) {
	const db = await getDb();
	return db.select().from( schema.cardLocations )
		.where( and(
			eq( schema.cardLocations.gameId, gameId ),
			eq( schema.cardLocations.cardId, cardId )
		) )
		.orderBy( desc( schema.cardLocations.weight ) );
}

export async function getAskMoves( gameId: string ) {
	const db = await getDb();
	return db.select().from( schema.asks )
		.where( eq( schema.asks.gameId, gameId ) )
		.orderBy( desc( schema.asks.timestamp ) );
}

export async function getAskMove( moveId: string ) {
	const db = await getDb();
	const [ ask ] = await db.select().from( schema.asks ).where( eq( schema.asks.id, moveId ) ).limit( 1 );
	return ask;
}

export async function getCallMoves( gameId: string ) {
	const db = await getDb();
	return db.select().from( schema.calls ).where( eq( schema.calls.gameId, gameId ) );
}

export async function getCallMove( moveId: string ) {
	const db = await getDb();
	const [ call ] = await db.select().from( schema.calls ).where( eq( schema.calls.id, moveId ) ).limit( 1 );
	return call;
}

export async function getTransferMoves( gameId: string ) {
	const db = await getDb();
	return db.select().from( schema.transfers ).where( eq( schema.transfers.gameId, gameId ) );
}

export async function getTransferMove( moveId: string ) {
	const db = await getDb();
	const [ transfer ] = await db.select().from( schema.transfers )
		.where( eq( schema.transfers.id, moveId ) ).limit( 1 );
	return transfer;
}

export async function createCardMappings( input: typeof schema.cardMappings.$inferInsert[] ) {
	const db = await getDb();
	return Promise.all( input.map( d => db.insert( schema.cardMappings ).values( d ).returning() ) );
}

export async function createAsk( input: typeof schema.asks.$inferInsert ) {
	const db = await getDb();
	const [ ask ] = await db.insert( schema.asks ).values( input ).returning();
	return ask;
}

export async function createCall( input: typeof schema.calls.$inferInsert ) {
	const db = await getDb();
	const [ call ] = await db.insert( schema.calls ).values( input ).returning();
	return call;
}

export async function createTransfer( input: typeof schema.transfers.$inferInsert ) {
	const db = await getDb();
	const [ transfer ] = await db.insert( schema.transfers ).values( input ).returning();
	return transfer;
}

export async function updateGameStatus( gameId: string, status: Literature.GameStatus ) {
	const db = await getDb();
	await db.update( schema.games ).set( { status } ).where( eq( schema.games.id, gameId ) );
}

export async function updateCurrentTurn( gameId: string, currentTurn: string ) {
	const db = await getDb();
	await db.update( schema.games ).set( { currentTurn } ).where( eq( schema.games.id, gameId ) );
}

export async function updateLastMove( gameId: string, lastMoveId: string ) {
	const db = await getDb();
	await db.update( schema.games ).set( { lastMoveId } ).where( eq( schema.games.id, gameId ) );
}

export async function updateCardMapping( cardId: string, gameId: string, playerId: string ) {
	const db = await getDb();
	await db.update( schema.cardMappings )
		.set( { playerId } )
		.where( and(
			eq( schema.cardMappings.gameId, gameId ),
			eq( schema.cardMappings.cardId, cardId )
		) );
}

export async function deleteCardMappings( gameId: string, cardIds: string[] ) {
	const db = await getDb();
	await db.delete( schema.cardMappings )
		.where( and(
			eq( schema.cardMappings.gameId, gameId ),
			inArray( schema.cardMappings.cardId, cardIds )
		) );
}

export async function updateTeamScore( teamId: string, score: number, setsWon: string ) {
	const db = await getDb();
	await db.update( schema.teams ).set( { score, setsWon } ).where( eq( schema.teams.id, teamId ) );
}

export async function assignTeamsToPlayers( teamData: Record<string, Literature.Team> ) {
	const db = await getDb();
	await Promise.all(
		Object.keys( teamData ).map( teamId => {
			const playerIds = teamData[ teamId ].memberIds;
			return db.update( schema.players )
				.set( { teamId } )
				.where( inArray( schema.players.id, playerIds.split( "," ) ) );
		} )
	);
}

export async function createCardLocations( input: typeof schema.cardLocations.$inferInsert[] ) {
	const db = await getDb();
	return Promise.all( input.map( d => db.insert( schema.cardLocations ).values( d ).returning() ).flat() );
}

export async function deleteCardLocationForCards( gameId: string, cardIds: string[] ) {
	const db = await getDb();
	await db.delete( schema.cardLocations ).where(
		and(
			eq( schema.cardLocations.gameId, gameId ),
			inArray( schema.cardLocations.cardId, cardIds )
		)
	);
}

export async function updateCardLocations( inputs: typeof schema.cardLocations.$inferInsert[] ) {
	const db = await getDb();
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