import { users } from "@/auth/schema";
import type { CardSuit } from "@/libs/cards/types";
import { generateAvatar, generateGameCode, generateId, generateName } from "@/shared/utils/generator";
import { foreignKey, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const games = sqliteTable( "clbk_games", {
	id: text( "id" ).notNull().$default( () => generateId() ).primaryKey(),
	code: text( "code" ).notNull().unique().$default( () => generateGameCode() ),
	dealCount: integer( "deal_count" ).default( 5 ).notNull(),
	trumpSuit: text( "trump_suit" ).notNull().$type<CardSuit>(),
	status: text( "status" ).notNull().$type<"CREATED" | "IN_PROGRESS" | "COMPLETED">().default( "CREATED" ),
	createdBy: text( "created_by" ).notNull().references( () => users.id )
} );

export const players = sqliteTable(
	"clbk_players",
	{
		id: text( "id" ).notNull().$default( () => generateId() ),
		name: text( "name" ).notNull().$default( () => generateName() ),
		username: text( "username" ).notNull().unique().$default( () => generateId() ),
		avatar: text( "avatar" ).notNull().$default( () => generateAvatar() ),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		isBot: integer( "is_bot" ).notNull().default( 0 )
	},
	( table ) => [ primaryKey( { columns: [ table.id, table.gameId ] } ) ]
);

export const deals = sqliteTable(
	"clbk_deals",
	{
		id: text( "id" ).notNull().$default( () => generateId() ),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		playerOrder: text( "player_order" ).notNull(),
		status: text( "status" ).notNull().$type<"CREATED" | "IN_PROGRESS" | "COMPLETED">().default( "CREATED" ),
		turnIdx: integer( "turn_idx" ).notNull().default( 0 ),
		createdAt: text( "created_at" ).notNull().$default( () => new Date().toISOString() )
	},
	table => [ primaryKey( { columns: [ table.id, table.gameId ] } ) ]
);

export const dealScores = sqliteTable(
	"clbk_deal_scores",
	{
		id: text( "id" ).notNull().$default( () => generateId() ),
		dealId: text( "deal_id" ).notNull(),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		playerId: text( "player_id" ).notNull().references( () => users.id ),
		declarations: integer( "declarations" ).notNull().default( 2 ),
		wins: integer( "wins" ).notNull().default( 0 )
	},
	table => [
		primaryKey( { columns: [ table.id, table.dealId, table.gameId ] } ),
		foreignKey( {
			columns: [ table.dealId, table.gameId ],
			foreignColumns: [ deals.id, deals.gameId ]
		} )
	]
);

export const cardMappings = sqliteTable(
	"clbk_card_mappings",
	{
		cardId: text( "card_id" ).notNull(),
		dealId: text( "deal_id" ).notNull(),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		playerId: text( "player_id" ).notNull().references( () => users.id )
	},
	table => [
		primaryKey( { columns: [ table.cardId, table.dealId, table.gameId ] } ),
		foreignKey( {
			columns: [ table.dealId, table.gameId ],
			foreignColumns: [ deals.id, deals.gameId ]
		} )
	]
);

export const rounds = sqliteTable(
	"clbk_rounds",
	{
		id: text( "id" ).notNull().$default( () => generateId() ),
		dealId: text( "deal_id" ).notNull(),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		winner: text( "winner" ).references( () => users.id ),
		suit: text( "suit" ).$type<CardSuit>(),
		playerOrder: text( "player_order" ).notNull(),
		turnIdx: integer( "turn_idx" ).notNull().default( 0 ),
		completed: integer( "completed" ).notNull().default( 0 ),
		createdAt: text( "created_at" ).notNull().$default( () => new Date().toISOString() )
	},
	table => [
		primaryKey( { columns: [ table.id, table.dealId, table.gameId ] } ),
		foreignKey( {
			columns: [ table.dealId, table.gameId ],
			foreignColumns: [ deals.id, deals.gameId ]
		} )
	]
);

export const cardPlays = sqliteTable(
	"clbk_card_plays",
	{
		id: text( "id" ).notNull().$default( () => generateId() ),
		roundId: text( "round_id" ).notNull(),
		dealId: text( "deal_id" ).notNull(),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		playerId: text( "player_id" ).notNull().references( () => users.id ),
		cardId: text( "card_id" ).notNull()
	},
	table => [
		primaryKey( { columns: [ table.id, table.dealId, table.gameId ] } ),
		foreignKey( {
			columns: [ table.roundId, table.dealId, table.gameId ],
			foreignColumns: [ rounds.id, rounds.dealId, rounds.gameId ]
		} ),
		foreignKey( {
			columns: [ table.dealId, table.gameId ],
			foreignColumns: [ deals.id, deals.gameId ]
		} )
	]
);