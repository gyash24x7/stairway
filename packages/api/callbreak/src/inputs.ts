import { z } from "zod";

export const createGameInputSchema = z.object( {
	dealCount: z.number().positive().optional(),
	trumpSuit: z.string()
} );

export type CreateGameInput = z.infer<typeof createGameInputSchema>;

export const joinGameInputSchema = z.object( {
	code: z.string()
} );

export type JoinGameInput = z.infer<typeof joinGameInputSchema>;

export const declareDealWinsInputSchema = z.object( {
	wins: z.number().positive().lte( 13 ),
	dealId: z.string().cuid2(),
	gameId: z.string().cuid2()
} );

export type DeclareDealWinsInput = z.infer<typeof declareDealWinsInputSchema>;

export const playCardInputSchema = z.object( {
	cardId: z.string(),
	roundId: z.string().cuid2(),
	dealId: z.string().cuid2(),
	gameId: z.string().cuid2()
} );

export type PlayCardInput = z.infer<typeof playCardInputSchema>;

export const gameIdInputSchema = z.object( {
	gameId: z.string().cuid2()
} );
