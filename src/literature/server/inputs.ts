import { CARD_IDS } from "@/libs/cards/constants";
import type { CardId } from "@/libs/cards/types";
import * as v from "valibot";

const ulid = () => v.pipe( v.string(), v.trim(), v.ulid() );
const cardId = () => v.custom<CardId>( ( value ) => CARD_IDS.includes( value as CardId ) );

export const createGameInputSchema = v.object( {
	playerCount: v.optional( v.pipe( v.number(), v.picklist( [ 2, 4, 6, 8 ] ) ) )
} );

export type CreateGameInput = v.InferOutput<typeof createGameInputSchema>;

export const joinGameInputSchema = v.object( {
	code: v.pipe( v.string(), v.trim(), v.length( 6 ) )
} );

export type JoinGameInput = v.InferOutput<typeof joinGameInputSchema>;

export const createTeamsInputSchema = v.object( {
	gameId: ulid(),
	data: v.record( v.string(), v.array( ulid() ) )
} );

export type CreateTeamsInput = v.InferOutput<typeof createTeamsInputSchema>;

export const startGameInputSchema = v.object( {
	gameId: ulid(),
	teams: v.record( v.string(), v.array( ulid() ) )
} );

export type StartGameInput = v.InferOutput<typeof startGameInputSchema>;

export const transferTurnInputSchema = v.object( {
	gameId: ulid(),
	transferTo: ulid()
} );

export type TransferTurnInput = v.InferOutput<typeof transferTurnInputSchema>;

export const callSetInputSchema = v.object( {
	gameId: ulid(),
	data: v.custom<Record<CardId, string>>( ( value ) => CARD_IDS.includes( value as CardId ) )
} );

export type CallSetInput = v.InferOutput<typeof callSetInputSchema>;

export const askCardInputSchema = v.object( {
	gameId: ulid(),
	from: ulid(),
	card: cardId()
} );

export type AskCardInput = v.InferOutput<typeof askCardInputSchema>;


export const gameIdInputSchema = v.object( { gameId: ulid() } );
export type GameIdInput = v.InferOutput<typeof gameIdInputSchema>;
