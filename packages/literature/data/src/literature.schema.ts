import type { CardSet } from "@common/cards";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { boolean, integer, json, pgEnum, pgSchema, primaryKey, smallint, text } from "drizzle-orm/pg-core";
import type { AskMoveData, CallMoveData, TransferMoveData } from "./literature.types";

export const literatureSchema = pgSchema( "literature" );

const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/svg?seed=";

export const literaturePlayers = literatureSchema.table(
	"literature_players",
	{
		id: text( "id" ).$default( () => createId() ).notNull(),
		name: text( "name" ).notNull(),
		avatar: text( "avatar" ).notNull().$default( () => AVATAR_BASE_URL.concat( createId() ).concat( ".svg?r=50" ) ),
		gameId: text( "game_id" ).notNull().references( () => literatureGames.id ),
		teamId: text( "team_id" ).references( () => literatureTeams.id ),
		isBot: boolean( "is_bot" ).notNull().default( false )
	},
	( table ) => {
		return {
			pk: primaryKey( { columns: [ table.id, table.gameId ] } )
		};
	}
);

export const literaturePlayerRelations = relations( literaturePlayers, ( { one, many } ) => {
	return {
		game: one( literatureGames, {
			fields: [ literaturePlayers.gameId ],
			references: [ literatureGames.id ]
		} ),
		team: one( literatureTeams, {
			fields: [ literaturePlayers.teamId ],
			references: [ literatureTeams.id ]
		} ),
		cardMappings: many( literatureCardMappings )
	};
} );

export const literatureTeams = literatureSchema.table( "literature_teams", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => literatureGames.id ),
	name: text( "name" ).notNull(),
	score: smallint( "score" ).notNull().default( 0 ),
	setsWon: json( "sets_won" ).notNull().$default( () => [] ).$type<CardSet[]>(),
	memberIds: json( "member_ids" ).notNull().$default( () => [] ).$type<string[]>()
} );

export const literatureTeamRelations = relations( literatureTeams, ( { many, one } ) => {
	return {
		game: one( literatureGames, {
			fields: [ literatureTeams.gameId ],
			references: [ literatureGames.id ]
		} ),
		members: many( literaturePlayers )
	};
} );

export const literatureCardMappings = literatureSchema.table(
	"literature_card_mappings",
	{
		cardId: text( "card_id" ).notNull(),
		playerId: text( "player_id" ).notNull(),
		gameId: text( "game_id" ).notNull().references( () => literatureGames.id )
	},
	table => {
		return {
			pk: primaryKey( { columns: [ table.cardId, table.gameId ] } )
		};
	}
);

export const literatureCardMappingRelations = relations( literatureCardMappings, ( { one } ) => {
	return {
		game: one( literatureGames, {
			fields: [ literatureCardMappings.gameId ],
			references: [ literatureGames.id ]
		} ),
		player: one( literaturePlayers, {
			fields: [ literatureCardMappings.playerId, literatureCardMappings.gameId ],
			references: [ literaturePlayers.id, literaturePlayers.gameId ]
		} )
	};
} );

export const literatureCardLocations = literatureSchema.table(
	"literature_card_locations",
	{
		gameId: text( "game_id" ).notNull(),
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

export const literatureMoveTypes = [ "ASK_CARD", "CALL_SET", "TRANSFER_TURN" ] as const;
export const literatureMoveTypeEnum = pgEnum( "literature_move_type", literatureMoveTypes );

export const literatureMoves = literatureSchema.table( "literature_moves", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => literatureGames.id ),
	playerId: text( "player_id" ).notNull(),
	timestamp: text( "timestamp" ).notNull().$default( () => new Date().toISOString() ),
	type: literatureMoveTypeEnum( "move_type" ).notNull(),
	description: text( "description" ).notNull(),
	success: boolean( "success" ).notNull(),
	data: json( "data" ).notNull().$type<AskMoveData | CallMoveData | TransferMoveData>()
} );

export const literatureMoveRelations = relations( literatureMoves, ( { one } ) => {
	return {
		game: one( literatureGames, {
			fields: [ literatureMoves.gameId ],
			references: [ literatureGames.id ]
		} )
	};
} );

export const literatureGameStatuses = [
	"CREATED",
	"PLAYERS_READY",
	"TEAMS_CREATED",
	"IN_PROGRESS",
	"COMPLETED"
] as const;
export const literatureGameStatusEnum = pgEnum( "literature_game_status", literatureGameStatuses );

function generateGameCode() {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < 6; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}

export const literatureGames = literatureSchema.table( "literature_games", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	code: text( "code" ).unique().$default( () => generateGameCode() ).notNull(),
	status: literatureGameStatusEnum( "status" ).notNull().default( "CREATED" ),
	playerCount: smallint( "player_count" ).notNull().default( 6 ),
	currentTurn: text( "current_turn" ).notNull()
} );

export const literatureGameRelations = relations( literatureGames, ( { many } ) => {
	return {
		players: many( literaturePlayers ),
		teams: many( literatureTeams ),
		moves: many( literatureMoves ),
		cardMappings: many( literatureCardMappings )
	};
} );

