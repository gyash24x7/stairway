import { createGameInputSchema, makeGuessInputSchema, playerGameInfoSchema } from "@/core/wordle/schema";
import { gameIdSchema } from "@/utils/schema";
import { oc } from "@orpc/contract";
import { array, string } from "valibot";

export const contract = {
	createGame: oc.input( createGameInputSchema ).output( playerGameInfoSchema ),
	getGameData: oc.input( gameIdSchema() ).output( playerGameInfoSchema ),
	makeGuess: oc.input( makeGuessInputSchema ).output( playerGameInfoSchema ),
	getWords: oc.input( gameIdSchema() ).output( array( string() ) )
};