import {
	createGameInputSchema,
	declareDealWinsInputSchema,
	joinGameInputSchema,
	playCardInputSchema,
	playerGameInfoSchema
} from "@/core/callbreak/schema";
import { gameIdSchema } from "@/utils/schema";
import { oc } from "@orpc/contract";
import { void_ } from "valibot";

export const contract = {
	createGame: oc.input( createGameInputSchema ).output( gameIdSchema() ),
	joinGame: oc.input( joinGameInputSchema ).output( gameIdSchema() ),
	getGameData: oc.input( gameIdSchema() ).output( playerGameInfoSchema ),
	declareDealWins: oc.input( declareDealWinsInputSchema ).output( void_() ),
	playCard: oc.input( playCardInputSchema ).output( void_() )
};