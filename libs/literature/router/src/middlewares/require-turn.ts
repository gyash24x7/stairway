import { LitTrpcMiddleware } from "@s2h/literature/router";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { logger } from "@s2h/utils";

export function requireTurn(): LitTrpcMiddleware {
	return async ( { ctx, next } ) => {
		logger.debug( ">> requireTurn()" );

		if ( !ctx.loggedInUser ) {
			logger.error( "User Not Logged In!" );
			throw new TRPCError( { code: "UNAUTHORIZED", message: Messages.USER_NOT_LOGGED_IN } );
		}

		if ( !ctx.currentGame ) {
			logger.error( "Game Not Present!" );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		if ( ctx.currentGame.currentTurn !== ctx.loggedInUser.id ) {
			logger.trace( "Game: %o", ctx.currentGame );
			logger.error( "It is not logged in User's turn! UserId: %s", ctx.loggedInUser.id );
			throw new TRPCError( { code: "FORBIDDEN", message: Messages.OUT_OF_TURN } );
		}

		return next( { ctx } );
	};
}