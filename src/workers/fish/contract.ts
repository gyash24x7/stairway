import {
	askEventInputSchema,
	claimEventInputSchema,
	createGameInputSchema,
	createTeamsInputSchema,
	joinGameInputSchema,
	playerGameInfoSchema,
	startGameInputSchema,
	transferEventInputSchema
} from "@/core/fish/schema";
import { gameIdSchema } from "@/utils/schema";
import { oc } from "@orpc/contract";
import { void_ } from "valibot";

export const contract = {
	createGame: oc.input( createGameInputSchema ).output( gameIdSchema() ),
	joinGame: oc.input( joinGameInputSchema ).output( gameIdSchema() ),
	getGameData: oc.input( gameIdSchema() ).output( playerGameInfoSchema ),
	createTeams: oc.input( createTeamsInputSchema ).output( void_() ),
	startGame: oc.input( startGameInputSchema ).output( void_() ),
	askCard: oc.input( askEventInputSchema ).output( void_() ),
	claimBook: oc.input( claimEventInputSchema ).output( void_() ),
	transferTurn: oc.input( transferEventInputSchema ).output( void_() )
};