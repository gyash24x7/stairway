import { CardRank, CardSuit } from "@s2h/cards";
import * as z from "zod";

export const playingCard = z.object( {
	rank: z.nativeEnum( CardRank ),
	suit: z.nativeEnum( CardSuit )
} );

export const askCardInput = z.object( {
	gameId: z.string().cuid(),
	askedFor: playingCard,
	askedFrom: z.string().cuid()
} );

export type AskCardInput = z.infer<typeof askCardInput>;

export const callSetInput = z.object( {
	gameId: z.string().cuid(),
	data: z.record( z.string(), z.array( playingCard ) )
} );

export type CallSetInput = z.infer<typeof callSetInput>;

export const createGameInput = z.object( {
	playerCount: z.number().int().optional()
} );

export type CreateGameInput = z.infer<typeof createGameInput>;

export const createTeamsInput = z.object( {
	teams: z.string().array().length( 2 ),
	gameId: z.string().cuid()
} );

export type CreateTeamsInput = z.infer<typeof createTeamsInput>;

export const declineCardInput = z.object( {
	gameId: z.string().cuid(),
	cardDeclined: playingCard
} );

export type DeclineCardInput = z.infer<typeof declineCardInput>;

export const getGameInput = z.object( {
	gameId: z.string().cuid()
} );

export type GetGameInput = z.infer<typeof getGameInput>;

export const giveCardInput = z.object( {
	gameId: z.string().cuid(),
	cardToGive: playingCard,
	giveTo: z.string().cuid()
} );

export type GiveCardInput = z.infer<typeof giveCardInput>;

export const joinGameInput = z.object( {
	code: z.string().length( 6 )
} );

export type JoinGameInput = z.infer<typeof joinGameInput>;

export const startGameInput = getGameInput;

export type StartGameInput = z.infer<typeof startGameInput>;

export const transferTurnInput = getGameInput;

export type TransferTurnInput = z.infer<typeof transferTurnInput>;