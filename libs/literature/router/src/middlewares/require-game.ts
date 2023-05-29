import { getGameInput } from "@s2h/literature/dtos";
import { LiteratureTrpcMiddleware } from "@s2h/literature/router";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { logger } from "@s2h/utils";

export function requireGame(): LiteratureTrpcMiddleware {
	return async ( { ctx, rawInput, next } ) => {
		logger.debug( ">> requireGame()" );
		const result = getGameInput.safeParse( rawInput );

		if ( !result.success ) {
			logger.error( "Error: %o", result.error );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_ID } );
		}

		const currentGame = await ctx.db.literature().get( result.data.gameId ).run( ctx.connection );
		if ( !currentGame ) {
			logger.error( "Game Not Found!" );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		return next( { ctx: { ...ctx, currentGame } } );
	};
}
