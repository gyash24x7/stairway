import { CardRank, CardSuit } from "@s2h/cards";
import * as z from "zod";

export const playingCardStruct = z.object( {
	rank: z.nativeEnum( CardRank ),
	suit: z.nativeEnum( CardSuit )
} );

export const askCardInputStruct = z.object( {
	gameId: z.string().cuid(),
	askedFor: playingCardStruct,
	askedFrom: z.string().cuid()
} );

export type AskCardInput = z.infer<typeof askCardInputStruct>;

export const callSetInputStruct = z.object( {
	gameId: z.string().cuid(),
	data: z.record( z.string(), z.array( playingCardStruct ) )
} );

export type CallSetInput = z.infer<typeof callSetInputStruct>;

export const createGameInputStruct = z.object( {
	playerCount: z.number().int()
} );

export type CreateGameInput = z.infer<typeof createGameInputStruct>;

export const createTeamsInputStruct = z.object( {
	teams: z.string().array().length( 2 ),
	gameId: z.string().cuid()
} );

export type CreateTeamsInput = z.infer<typeof createTeamsInputStruct>;

export const declineCardInputStruct = z.object( {
	gameId: z.string().cuid(),
	cardDeclined: playingCardStruct
} );

export type DeclineCardInput = z.infer<typeof declineCardInputStruct>;

export const getGameInputStruct = z.object( {
	gameId: z.string().cuid()
} );

export type GetGameInput = z.infer<typeof getGameInputStruct>;

export const giveCardInputStruct = z.object( {
	gameId: z.string().cuid(),
	cardToGive: playingCardStruct,
	giveTo: z.string().cuid()
} );

export type GiveCardInput = z.infer<typeof giveCardInputStruct>;

export const joinGameInputStruct = z.object( {
	code: z.string().length( 7 )
} );

export type JoinGameInput = z.infer<typeof joinGameInputStruct>;

export const startGameInputStruct = getGameInputStruct;

export type StartGameInput = z.infer<typeof startGameInputStruct>;

export const transferTurnInputStruct = getGameInputStruct;

export type TransferTurnInput = z.infer<typeof transferTurnInputStruct>;