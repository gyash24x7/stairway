import { z } from "zod";

export type CreateGameInput = z.infer<typeof createGameInputSchema>;
export const createGameInputSchema = z.object( {
	playerCount: z.number().positive().multipleOf( 2 ).lte( 8 )
} );


export type JoinGameInput = z.infer<typeof joinGameInputSchema>;
export const joinGameInputSchema = z.object( {
	code: z.string().length( 6 )
} );

export type CreateTeamsInput = z.infer<typeof createTeamsInputSchema>;
export const createTeamsInputSchema = z.object( {
	gameId: z.string(),
	data: z.record( z.string().array() )
} );

export type AskCardInput = z.infer<typeof askCardInputSchema>;
export const askCardInputSchema = z.object( {
	gameId: z.string(),
	from: z.string(),
	for: z.string()
} );

export type CallSetInput = z.infer<typeof callSetInputSchema>;
export const callSetInputSchema = z.object( {
	gameId: z.string(),
	data: z.record( z.string(), z.string() )
} );

export type TransferTurnInput = z.infer<typeof transferTurnInputSchema>;
export const transferTurnInputSchema = z.object( {
	gameId: z.string(),
	transferTo: z.string()
} );

export type GameIdInput = z.infer<typeof gameIdInputSchema>;
export const gameIdInputSchema = z.object( {
	gameId: z.string()
} );