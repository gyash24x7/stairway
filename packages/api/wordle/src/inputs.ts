import { z } from "zod";

export const createGameInputSchema = z.object( {
	wordCount: z.number().optional(),
	wordLength: z.number().optional()
} );

export type CreateGameInput = z.infer<typeof createGameInputSchema>;

export const makeGuessInputSchema = z.object( { gameId: z.string().cuid2(), guess: z.string() } );

export type MakeGuessInput = z.infer<typeof makeGuessInputSchema>;

export const gameIdInputSchema = z.object( { gameId: z.string().cuid2() } );

export type GameIdInput = z.infer<typeof gameIdInputSchema>;