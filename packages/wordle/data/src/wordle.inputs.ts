import { z } from "zod";

export type CreateGameInput = z.infer<typeof createGameInputSchema>
export const createGameInputSchema = z.object( {
	wordLength: z.number().min( 5 ).max( 6 ).optional(),
	wordCount: z.number().min( 1 ).max( 16 ).optional()
} );

export type MakeGuessInput = z.infer<typeof makeGuessInputSchema>;
export const makeGuessInputSchema = z.object( {
	gameId: z.string().cuid2(),
	guess: z.string()
} );

export type GameIdInput = z.infer<typeof gameIdInputSchema>;
export const gameIdInputSchema = z.object( {
	gameId: z.string().cuid2()
} );