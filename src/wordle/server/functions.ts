"use server";

import { authMiddleware } from "@/shared/utils/orpc";
import { createGameInputSchema, gameIdInputSchema, makeGuessInputSchema } from "@/wordle/server/inputs";
import * as service from "@/wordle/server/service";
import { os } from "@orpc/server";

export const createGame = os
	.use( authMiddleware )
	.input( createGameInputSchema )
	.handler( async ( { input, context } ) => service.createGame( input, context.authInfo ) )
	.actionable();

export const getGameData = os
	.use( authMiddleware )
	.input( gameIdInputSchema )
	.handler( async ( { input } ) => service.getGameData( input.gameId ) )
	.actionable();

export const makeGuess = os
	.use( authMiddleware )
	.input( makeGuessInputSchema )
	.handler( async ( { input } ) => service.makeGuess( input ) )
	.actionable();