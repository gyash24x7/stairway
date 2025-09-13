import { CARD_IDS, CARD_SUITS } from "@/core/cards/constants";
import { type PlayingCard, playingCardSchema } from "@/core/cards/types";
import { gameIdSchema, ulidSchema } from "@/utils/schema";
import { authInfoSchema } from "@/workers/auth/schema";
import {
	array,
	boolean,
	type InferInput,
	intersect,
	length,
	ltValue,
	number,
	object,
	omit,
	optional,
	picklist,
	pipe,
	record,
	string,
	trim
} from "valibot";

export type PlayerId = string;
export type Player = InferInput<typeof playerSchema>;
export const playerSchema = intersect( [
	authInfoSchema,
	object( { isBot: boolean() } )
] );

export type Round = InferInput<typeof roundSchema>;
export const roundSchema = object( {
	id: string(),
	playerOrder: array( string() ),
	status: picklist( [ "CREATED", "IN_PROGRESS", "COMPLETED" ] ),
	suit: optional( picklist( Object.values( CARD_SUITS ) ) ),
	cards: record( string(), picklist( CARD_IDS ) ),
	winner: optional( string() ),
	createdAt: number()
} );

export type HandData = Record<string, PlayingCard[]>;
export const handDataSchema = record( string(), array( playingCardSchema ) );

export type Deal = InferInput<typeof dealSchema>;
export const dealSchema = object( {
	id: string(),
	playerOrder: array( string() ),
	status: picklist( [ "CREATED", "IN_PROGRESS", "COMPLETED" ] ),
	hands: handDataSchema,
	declarations: record( string(), number() ),
	wins: record( string(), number() ),
	createdAt: number()
} );

export type DealWithRounds = Deal & { rounds: Round[] };
export type PlayerData = Record<string, Player>;

export type GameData = InferInput<typeof gameDataSchema>;
export const gameDataSchema = object( {
	id: string(),
	code: string(),
	dealCount: number(),
	trump: picklist( Object.values( CARD_SUITS ) ),
	currentTurn: string(),
	status: picklist( [
		"GAME_CREATED",
		"PLAYERS_READY",
		"CARDS_DEALT",
		"WINS_DECLARED",
		"ROUND_STARTED",
		"CARDS_PLAYED",
		"ROUND_COMPLETED",
		"DEAL_COMPLETED",
		"GAME_COMPLETED"
	] ),
	scores: record( string(), array( number() ) ),
	createdBy: string(),
	players: record( string(), playerSchema ),
	deals: array( intersect( [
		dealSchema,
		object( { rounds: array( roundSchema ) } )
	] ) )
} );

export type PlayerGameInfo = InferInput<typeof playerGameInfoSchema>;
export const playerGameInfoSchema = intersect( [
	omit( gameDataSchema, [ "deals" ] ),
	object( {
		playerId: string(),
		currentDeal: optional( omit( dealSchema, [ "hands" ] ) ),
		currentRound: optional( roundSchema ),
		hand: array( playingCardSchema )
	} )
] );

export type GameIdInput = InferInput<ReturnType<typeof gameIdSchema>>;

export type CreateGameInput = InferInput<typeof createGameInputSchema>;
export const createGameInputSchema = object( {
	dealCount: optional( pipe( number(), picklist( [ 5, 9, 13 ] ) ) ),
	trumpSuit: picklist( Object.values( CARD_SUITS ) ),
	gameId: optional( ulidSchema() )
} );

export type JoinGameInput = InferInput<typeof joinGameInputSchema>;
export const joinGameInputSchema = object( {
	code: pipe( string(), trim(), length( 6 ) )
} );

export type DeclareDealWinsInput = InferInput<typeof declareDealWinsInputSchema>;
export const declareDealWinsInputSchema = object( {
	wins: pipe( number(), ltValue( 13 ) ),
	dealId: ulidSchema(),
	gameId: ulidSchema()
} );

export type PlayCardInput = InferInput<typeof playCardInputSchema>;
export const playCardInputSchema = object( {
	cardId: picklist( CARD_IDS ),
	roundId: ulidSchema(),
	dealId: ulidSchema(),
	gameId: ulidSchema()
} );
