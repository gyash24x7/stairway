"use server";

import { authMiddleware } from "@/server/utils/orpc";
import { createGameInputSchema, gameIdInputSchema, makeGuessInputSchema } from "@/server/wordle/inputs";
import * as service from "@/server/wordle/service";
import { os } from "@orpc/server";

export const createGame = os
	.use( authMiddleware )
	.input( createGameInputSchema )
	.handler( async ( { input, context } ) => service.createGame( input, context ) )
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