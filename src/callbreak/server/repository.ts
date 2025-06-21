import * as schema from "@/callbreak/schema";
import { getDb } from "@/shared/db";
import { and, desc, eq } from "drizzle-orm";

export async function getGameById( id: string ) {
	const db = await getDb();
	const [ game ] = await db.select().from( schema.games ).where( eq( schema.games.id, id ) );
	const players = await db.select().from( schema.players ).where( eq( schema.players.gameId, id ) );
	return { ...game, players };
}

export async function getGameByCode( code: string ) {
	const db = await getDb();
	const [ game ] = await db.select().from( schema.games ).where( eq( schema.games.code, code ) );
	const players = await db.select().from( schema.players ).where( eq( schema.players.gameId, game.id ) );
	return { ...game, players };
}

export async function getActiveDeal( gameId: string ) {
	const db = await getDb();
	const [ deal ] = await db.select().from( schema.deals )
		.where( and(
			eq( schema.deals.gameId, gameId ),
			eq( schema.deals.status, "IN_PROGRESS" )
		) )
		.orderBy( desc( schema.deals.createdAt ) )
		.limit( 1 );

	if ( !!deal ) {
		const rounds = await db.select().from( schema.rounds ).where( and(
			eq( schema.rounds.dealId, deal.id ),
			eq( schema.rounds.gameId, gameId )
		) );

		const scores = await db.select().from( schema.dealScores ).where( and(
			eq( schema.dealScores.dealId, deal.id ),
			eq( schema.dealScores.gameId, gameId )
		) );

		return {
			...deal,
			rounds,
			scores: scores.reduce(
				( acc, score ) => {
					acc[ score.playerId ] = score;
					return acc;
				},
				{} as Record<string, { declarations: number, wins: number }>
			)
		};
	}

	return undefined;
}

export async function getActiveRound( dealId: string, gameId: string ) {
	const db = await getDb();
	const [ round ] = await db.select().from( schema.rounds )
		.where( and(
			eq( schema.rounds.dealId, dealId ),
			eq( schema.rounds.gameId, gameId ),
			eq( schema.rounds.completed, 0 )
		) )
		.orderBy( desc( schema.rounds.createdAt ) )
		.limit( 1 );

	const cardPlays = await db.select().from( schema.cardPlays )
		.where( and(
			eq( schema.cardPlays.roundId, round.id ),
			eq( schema.cardPlays.dealId, dealId ),
			eq( schema.cardPlays.gameId, gameId )
		) );

	const cards = cardPlays.reduce(
		( acc, cardPlay ) => {
			acc[ cardPlay.playerId ] = cardPlay.cardId;
			return acc;
		},
		{} as Record<string, string>
	);

	return { ...round, cards };
}

export async function getScores( gameId: string ): Promise<Record<string, number>[]> {
	const db = await getDb();
	const scores = await db.select().from( schema.dealScores ).where( eq( schema.dealScores.gameId, gameId ) );
	return Object.values( scores.reduce(
		( acc, score ) => {
			if ( !acc[ score.dealId ] ) {
				acc[ score.dealId ] = {};
			}

			acc[ score.dealId ][ score.playerId ] = score.declarations < score.wins
				? 10 * score.declarations + 2 * ( score.wins - score.declarations )
				: -10 * score.declarations;

			return acc;
		},
		{} as Record<string, Record<string, number>>
	) );
}

export async function getCardMappingsForPlayer( dealId: string, gameId: string, playerId: string ) {
	const db = await getDb();
	return db.select().from( schema.cardMappings )
		.where( and(
			eq( schema.cardMappings.dealId, dealId ),
			eq( schema.cardMappings.gameId, gameId ),
			eq( schema.cardMappings.playerId, playerId )
		) );
}

export async function createGame( game: typeof schema.games.$inferInsert ) {
	const db = await getDb();
	const [ newGame ] = await db.insert( schema.games ).values( game ).returning();
	return newGame;
}

export async function createPlayer( player: typeof schema.players.$inferInsert ) {
	const db = await getDb();
	const [ newPlayer ] = await db.insert( schema.players ).values( player ).returning();
	return newPlayer;
}

export async function createDeal( deal: typeof schema.deals.$inferInsert ) {
	const db = await getDb();
	const [ newDeal ] = await db.insert( schema.deals ).values( deal ).returning();
	return newDeal;
}

export async function createRound( round: typeof schema.rounds.$inferInsert ) {
	const db = await getDb();
	const [ newRound ] = await db.insert( schema.rounds ).values( round ).returning();
	return newRound;
}

export async function createCardPlay( cardPlay: typeof schema.cardPlays.$inferInsert ) {
	const db = await getDb();
	const [ newCardPlay ] = await db.insert( schema.cardPlays ).values( cardPlay ).returning();
	return newCardPlay;
}

export async function createCardMappings( cardMappings: typeof schema.cardMappings.$inferInsert[] ) {
	const db = await getDb();
	return db.insert( schema.cardMappings ).values( cardMappings ).returning();
}

export async function createDealScore( dealScore: typeof schema.dealScores.$inferInsert ) {
	const db = await getDb();
	const [ newDeclaration ] = await db.insert( schema.dealScores ).values( dealScore ).returning();
	return newDeclaration;
}

export async function updateDeal( dealId: string, gameId: string, updates: Partial<typeof schema.deals.$inferSelect> ) {
	const db = await getDb();
	const [ updatedDeal ] = await db.update( schema.deals )
		.set( updates )
		.where( and(
			eq( schema.deals.id, dealId ),
			eq( schema.deals.gameId, gameId )
		) )
		.returning();
	return updatedDeal;
}

export async function updateRound(
	roundId: string,
	dealId: string,
	gameId: string,
	updates: Partial<typeof schema.rounds.$inferSelect>
) {
	const db = await getDb();
	const [ updatedRound ] = await db.update( schema.rounds )
		.set( updates )
		.where( and(
			eq( schema.rounds.id, roundId ),
			eq( schema.rounds.dealId, dealId ),
			eq( schema.rounds.gameId, gameId )
		) )
		.returning();
	return updatedRound;
}

export async function updateDealScore(
	dealId: string,
	gameId: string,
	playerId: string,
	updates: Partial<typeof schema.dealScores.$inferSelect>
) {
	const db = await getDb();
	const [ updatedScore ] = await db.update( schema.dealScores )
		.set( updates )
		.where( and(
			eq( schema.dealScores.dealId, dealId ),
			eq( schema.dealScores.gameId, gameId ),
			eq( schema.dealScores.playerId, playerId )
		) )
		.returning();
	return updatedScore;
}

export async function updateGame( gameId: string, updates: Partial<typeof schema.games.$inferSelect> ) {
	const db = await getDb();
	const [ updatedGame ] = await db.update( schema.games )
		.set( updates )
		.where( eq( schema.games.id, gameId ) )
		.returning();
	return updatedGame;
}

export async function deleteCardMapping( cardId: string, dealId: string, gameId: string ) {
	const db = await getDb();
	await db.delete( schema.cardMappings )
		.where( and(
			eq( schema.cardMappings.cardId, cardId ),
			eq( schema.cardMappings.dealId, dealId ),
			eq( schema.cardMappings.gameId, gameId )
		) );
}

export async function getCompletedDealCount( gameId: string ) {
	const db = await getDb();
	return db.$count( schema.deals, and(
		eq( schema.deals.gameId, gameId ),
		eq( schema.deals.status, "COMPLETED" )
	) );
}

export async function getCardsPlayedInDeal( dealId: string, gameId: string ) {
	const db = await getDb();
	return db.select().from( schema.cardPlays )
		.where( and(
			eq( schema.cardPlays.dealId, dealId ),
			eq( schema.cardPlays.gameId, gameId )
		) );
}