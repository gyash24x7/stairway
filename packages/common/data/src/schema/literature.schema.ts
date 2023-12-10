import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { boolean, json, pgEnum, pgSchema, primaryKey, smallint, text } from "drizzle-orm/pg-core";

export const schema = pgSchema( "literature" );

const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/svg?seed=";

export const players = schema.table(
	"players",
	{
		id: text( "id" ).$default( () => createId() ).notNull(),
		name: text( "name" ).notNull(),
		avatar: text( "avatar" ).notNull().$default( () => AVATAR_BASE_URL.concat( createId() ).concat( ".svg?r=50" ) ),
		gameId: text( "game_id" ).notNull().references( () => games.id ),
		teamId: text( "team_id" ).references( () => teams.id )
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

export const teams = schema.table( "teams", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
	name: text( "name" ).notNull(),
	score: smallint( "score" ).notNull().default( 0 ),
	setsWon: json( "sets_won" ).notNull().$default( () => [] ).$type<string[]>(),
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

export const cardMappings = schema.table(
	"card_mappings",
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

export const moveTypeEnum = pgEnum( "literature_move_type", [ "ASK_CARD", "CALL_SET", "TRANSFER_TURN" ] );

export type AskMoveData = { from: string, by: string, card: string };
export type CallMoveData = { cardSet: string, actualCall: Record<string, string>, correctCall: Record<string, string> }
export type TransferMoveData = { to: string };

export const moves = schema.table( "moves", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	gameId: text( "game_id" ).notNull().references( () => games.id ),
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

export const gameStatusEnum = pgEnum( "literature_game_status", [
	"CREATED",
	"PLAYERS_READY",
	"TEAMS_CREATED",
	"IN_PROGRESS",
	"COMPLETED"
] );

function generateGameCode() {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < 6; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}

export const games = schema.table( "games", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	code: text( "code" ).unique().$default( () => generateGameCode() ).notNull(),
	status: gameStatusEnum( "status" ).notNull().default( "CREATED" ),
	playerCount: smallint( "player_count" ).notNull().default( 6 ),
	currentTurn: text( "current_turn" ).notNull()
} );

export const gameRelation = relations( games, ( { many } ) => {
	return {
		players: many( players ),
		teams: many( teams ),
		moves: many( moves ),
		cardMappings: many( cardMappings )
	};
} );




