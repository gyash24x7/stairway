import { createGameInputSchema, gameDataSchema, makeGuessInputSchema } from "@/core/wordle/schema";
import { gameIdSchema } from "@/utils/schema";
import { oc } from "@orpc/contract";

export const contract = {
	createGame: oc.input( createGameInputSchema ).output( gameDataSchema ),
	getGameData: oc.input( gameIdSchema() ).output( gameDataSchema ),
	makeGuess: oc.input( makeGuessInputSchema ).output( gameDataSchema )
};