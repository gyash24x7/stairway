import { createId } from "@paralleldrive/cuid2";
import { CardSet } from "@stairway/cards";
import { relations } from "drizzle-orm";
import { boolean, integer, json, pgEnum, pgSchema, primaryKey, smallint, text } from "drizzle-orm/pg-core";

export const literatureSchema = pgSchema( "literature" );

const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/png?seed=";

export const players = literatureSchema.table(
	"lit_players",
	{
		id: text( "id" ).$default( () => createId() ).notNull(),
		name: text( "name" ).notNull(),
		avatar: text( "avatar" ).notNull().$default( () => AVATAR_BASE_URL.concat( createId() ).concat( "&r=50" ) ),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		teamId: text( "team_id" ).references( () => teams.id ),
		isBot: boolean( "is_bot" ).notNull().default( false )
	},
	( table ) => {
		return {
			pk: primaryKey( { columns: [ table.id, table.gameId ] } )
		};
	}
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

export const teams = literatureSchema.table( "lit_teams", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	name: text( "name" ).notNull(),
	score: smallint( "score" ).notNull().default( 0 ),
	setsWon: text( "sets_won" ).array().notNull().$default( () => [] ),
	memberIds: text( "member_ids" ).array().notNull()
} );

export const teamRelations = relations( teams, ( { one } ) => ( {
	game: one( games, {
		fields: [ teams.gameId ],
		references: [ games.id ]
	} )
} ) );

export const cardMappings = literatureSchema.table(
	"lit_card_mappings",
	{
		cardId: text( "card_id" ).notNull(),
		playerId: text( "player_id" ).notNull(),
		gameId: text( "game_id" ).notNull().references( () => games.id )
	},
	table => {
		return {
			pk: primaryKey( { columns: [ table.cardId, table.gameId ] } )
		};
	}
);

export const cardMappingRelations = relations( cardMappings, ( { one } ) => {
	return {
		game: one( games, {
			fields: [ cardMappings.gameId ],
			references: [ games.id ]
		} ),
		player: one( players, {
			fields: [ cardMappings.playerId, cardMappings.gameId ],
			references: [ players.id, players.gameId ]
		} )
	};
} );

export const cardLocations = literatureSchema.table(
	"lit_card_locations",
	{
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		playerId: text( "player_id" ).notNull(),
		cardId: text( "card_id" ).notNull(),
		playerIds: json( "player_ids" ).$type<string[]>().notNull(),
		weight: integer( "weight" ).notNull()
	},
	table => {
		return {
			pk: primaryKey( { columns: [ table.gameId, table.playerId, table.cardId ] } )
		};
	}
);

export const asks = literatureSchema.table( "lit_asks", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	playerId: text( "player_id" ).notNull(),
	timestamp: text( "timestamp" ).notNull().$default( () => new Date().toISOString() ),
	description: text( "description" ).notNull(),
	success: boolean( "success" ).notNull(),
	cardId: text( "card_id" ).notNull(),
	askedFrom: text( "asked_from" ).notNull()
} );

export const calls = literatureSchema.table( "lit_calls", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	playerId: text( "player_id" ).notNull(),
	timestamp: text( "timestamp" ).notNull().$default( () => new Date().toISOString() ),
	description: text( "description" ).notNull(),
	success: boolean( "success" ).notNull(),
	cardSet: text( "card_set" ).notNull().$type<CardSet>(),
	actualCall: json( "actual_call" ).notNull().$type<Record<string, string>>(),
	correctCall: json( "correct_call" ).notNull().$type<Record<string, string>>()
} );

export const transfers = literatureSchema.table( "lit_transfers", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	playerId: text( "player_id" ).notNull(),
	timestamp: text( "timestamp" ).notNull().$default( () => new Date().toISOString() ),
	description: text( "description" ).notNull(),
	success: boolean( "success" ).notNull(),
	transferTo: text( "transfer_to" ).notNull()
} );

export const gameStatuses = [ "CREATED", "PLAYERS_READY", "TEAMS_CREATED", "IN_PROGRESS", "COMPLETED" ] as const;
export const literatureGameStatusEnum = pgEnum( "lit_game_status", gameStatuses );

function generateGameCode() {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < 6; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}

export const games = literatureSchema.table( "lit_games", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	code: text( "code" ).unique().$default( () => generateGameCode() ).notNull(),
	status: literatureGameStatusEnum( "status" ).notNull().default( "CREATED" ),
	playerCount: smallint( "player_count" ).notNull().default( 6 ),
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

