import { CardSuit } from "@/libs/cards/types";
import { z } from "zod/v4";

export const createGameInputSchema = z.object( {
	dealCount: z.number().positive().optional(),
	trumpSuit: z.enum( [ CardSuit.CLUBS, CardSuit.DIAMONDS, CardSuit.HEARTS, CardSuit.SPADES ] )
} );

export type CreateGameInput = z.infer<typeof createGameInputSchema>;

export const joinGameInputSchema = z.object( {
	code: z.string()
} );

export type JoinGameInput = z.infer<typeof joinGameInputSchema>;

export const declareDealWinsInputSchema = z.object( {
	wins: z.number().positive().lte( 13 ),
	dealId: z.ulid(),
	gameId: z.ulid(),
	playerId: z.ulid()
} );

export type DeclareDealWinsInput = z.infer<typeof declareDealWinsInputSchema>;

export const playCardInputSchema = z.object( {
	cardId: z.string(),
	roundId: z.ulid(),
	dealId: z.ulid(),
	gameId: z.ulid(),
	playerId: z.ulid()
} );

export type PlayCardInput = z.infer<typeof playCardInputSchema>;

export const gameIdInputSchema = z.object( {
	gameId: z.ulid()
} );

export type GameIdInput = z.infer<typeof gameIdInputSchema>;