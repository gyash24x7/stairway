import { users } from "@/auth/schema";
import type { CardSet } from "@/libs/cards/types";
import { generateGameCode, generateId } from "@/shared/utils/generator";
import { relations } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable(
	"lit_players",
	{
		userId: text( "user_id" ).notNull().references( () => users.id ),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		teamId: text( "team_id" ).references( () => teams.id )
	},
	( table ) => [ primaryKey( { columns: [ table.userId, table.gameId ] } ) ]
);

export const playerRelations = relations( players, ( { one, many } ) => ( {
	game: one( games, {
		fields: [ players.gameId ],
		references: [ games.id ]
	} ),
	team: one( teams, {
		fields: [ players.teamId ],
		references: [ teams.id ]
	} ),
	cardMappings: many( cardMappings )
} ) );

export const teams = sqliteTable( "lit_teams", {
	id: text( "id" ).$default( () => generateId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	name: text( "name" ).notNull(),
	score: integer( "score" ).notNull().default( 0 ),
	setsWon: text( "sets_won" ).notNull().default( "" ),
	memberIds: text( "member_ids" ).notNull()
} );

export const teamRelations = relations( teams, ( { one } ) => ( {
	game: one( games, {
		fields: [ teams.gameId ],
		references: [ games.id ]
	} )
} ) );

export const cardMappings = sqliteTable(
	"lit_card_mappings",
	{
		cardId: text( "card_id" ).notNull(),
		playerId: text( "player_id" ).notNull(),
		gameId: text( "game_id" ).notNull().references( () => games.id )
	},
	table => [ primaryKey( { columns: [ table.cardId, table.gameId ] } ) ]
);

export const cardMappingRelations = relations( cardMappings, ( { one } ) => {
	return {
		game: one( games, {
			fields: [ cardMappings.gameId ],
			references: [ games.id ]
		} ),
		player: one( players, {
			fields: [ cardMappings.playerId, cardMappings.gameId ],
			references: [ players.userId, players.gameId ]
		} )
	};
} );

export const cardLocations = sqliteTable(
	"lit_card_locations",
	{
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		playerId: text( "player_id" ).notNull(),
		cardId: text( "card_id" ).notNull(),
		playerIds: text( "player_ids" ).notNull(),
		weight: integer( "weight" ).notNull()
	},
	table => [ primaryKey( { columns: [ table.gameId, table.playerId, table.cardId ] } ) ]
);

export const asks = sqliteTable( "lit_asks", {
	id: text( "id" ).$default( () => generateId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	playerId: text( "player_id" ).notNull(),
	timestamp: text( "timestamp" ).notNull().$default( () => new Date().toISOString() ),
	description: text( "description" ).notNull(),
	success: integer( "success" ).notNull().default( 0 ),
	cardId: text( "card_id" ).notNull(),
	askedFrom: text( "asked_from" ).notNull()
} );

export const calls = sqliteTable( "lit_calls", {
	id: text( "id" ).$default( () => generateId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	playerId: text( "player_id" ).notNull(),
	timestamp: text( "timestamp" ).notNull().$default( () => new Date().toISOString() ),
	description: text( "description" ).notNull(),
	success: integer( "success" ).notNull().default( 0 ),
	cardSet: text( "card_set" ).notNull().$type<CardSet>(),
	actualCall: text( "actual_call" ).notNull().$type<Record<string, string>>(),
	correctCall: text( "correct_call" ).notNull().$type<Record<string, string>>()
} );

export const transfers = sqliteTable( "lit_transfers", {
	id: text( "id" ).$default( () => generateId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	playerId: text( "player_id" ).notNull(),
	timestamp: text( "timestamp" ).notNull().$default( () => new Date().toISOString() ),
	description: text( "description" ).notNull(),
	success: integer( "success" ).notNull().default( 0 ),
	transferTo: text( "transfer_to" ).notNull()
} );

type Status = "CREATED" | "PLAYERS_READY" | "TEAMS_CREATED" | "IN_PROGRESS" | "COMPLETED";

export const games = sqliteTable( "lit_games", {
	id: text( "id" ).$default( () => generateId() ).primaryKey(),
	code: text( "code" ).unique().$default( () => generateGameCode() ).notNull(),
	status: text( "status" ).notNull().$type<Status>().default( "CREATED" ),
	playerCount: integer( "player_count" ).notNull().default( 6 ),
	currentTurn: text( "current_turn" ).notNull(),
	lastMoveId: text( "last_move_id" ).notNull().default( "" )
} );

export const gameRelations = relations( games, ( { many } ) => {
	return {
		players: many( players ),
		teams: many( teams ),
		asks: many( asks ),
		calls: many( calls ),
		transfers: many( transfers ),
		cardMappings: many( cardMappings ),
		cardLocations: many( cardLocations )
	};
} );