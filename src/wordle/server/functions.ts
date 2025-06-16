"use server";

import { createGameInputSchema, gameIdInputSchema, makeGuessInputSchema } from "@/wordle/server/inputs";
import * as service from "@/wordle/server/service";
import { os } from "@orpc/server";
import { requestInfo } from "rwsdk/worker";

export const createGame = os
	.input( createGameInputSchema )
	.handler( async ( { input } ) => service.createGame( input, requestInfo.ctx.authInfo! ) )
	.actionable();

export const getGameData = os
	.input( gameIdInputSchema )
	.handler( async ( { input } ) => service.getGameData( input.gameId ) )
	.actionable();

export const makeGuess = os
	.input( makeGuessInputSchema )
	.handler( async ( { input } ) => service.makeGuess( input ) )
	.actionable();