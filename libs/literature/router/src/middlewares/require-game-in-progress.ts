import { LiteratureTrpcMiddleware } from "@s2h/literature/router";
import { LiteratureGameStatus } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { logger } from "@s2h/utils";

export function requireGameInProgress(): LiteratureTrpcMiddleware {
	return async ( { ctx, next } ) => {
		logger.debug( ">> requireGameInProgress()" );

		if ( !ctx.currentGame ) {
			logger.error( "Game Not Present!" );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		if ( ctx.currentGame.status !== LiteratureGameStatus.IN_PROGRESS ) {
			logger.debug( "Game Present but not in progress!" );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
		}

		return next( { ctx } );
	};
}