import { createId } from "@paralleldrive/cuid2";
import type { CardSet } from "@stairway/cards";
import { relations } from "drizzle-orm";
import { boolean, integer, json, pgEnum, pgSchema, primaryKey, smallint, text } from "drizzle-orm/pg-core";
import type { AskMoveData, CallMoveData, TransferMoveData } from "./literature.types.ts";

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

export const playerRelations = relations( players, ( { one, many } ) => {
	return {
		game: one( games, {
			fields: [ players.gameId ],
			references: [ games.id ]
		} ),
		team: one( teams, {
			fields: [ players.teamId ],
			references: [ teams.id ]
		} ),
		cardMappings: many( cardMappings )
	};
} );

export const teams = literatureSchema.table( "lit_teams", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	name: text( "name" ).notNull(),
	score: smallint( "score" ).notNull().default( 0 ),
	setsWon: json( "sets_won" ).notNull().$default( () => [] ).$type<CardSet[]>(),
	memberIds: json( "member_ids" ).notNull().$default( () => [] ).$type<string[]>()
} );

export const teamRelations = relations( teams, ( { many, one } ) => {
	return {
		game: one( games, {
			fields: [ teams.gameId ],
			references: [ games.id ]
		} ),
		members: many( players )
	};
} );

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

export const moveTypes = [ "ASK_CARD", "CALL_SET", "TRANSFER_TURN" ] as const;
export const moveTypeEnum = pgEnum( "lit_move_type", moveTypes );

export const moves = literatureSchema.table( "lit_moves", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	playerId: text( "player_id" ).notNull(),
	timestamp: text( "timestamp" ).notNull().$default( () => new Date().toISOString() ),
	type: moveTypeEnum( "move_type" ).notNull(),
	description: text( "description" ).notNull(),
	success: boolean( "success" ).notNull(),
	data: json( "data" ).notNull().$type<AskMoveData | CallMoveData | TransferMoveData>()
} );

export const moveRelations = relations( moves, ( { one } ) => {
	return {
		game: one( games, {
			fields: [ moves.gameId ],
			references: [ games.id ]
		} )
	};
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
	currentTurn: text( "current_turn" ).notNull()
} );

export const gameRelations = relations( games, ( { many } ) => {
	return {
		players: many( players ),
		teams: many( teams ),
		moves: many( moves ),
		cardMappings: many( cardMappings ),
		cardLocations: many( cardLocations )
	};
} );

