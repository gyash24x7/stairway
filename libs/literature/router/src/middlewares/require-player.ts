import { LiteratureTrpcMiddleware } from "@s2h/literature/router";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { logger } from "@s2h/utils";

export function requirePlayer(): LiteratureTrpcMiddleware {
	return async ( { ctx, next } ) => {
		logger.debug( ">> requirePlayer()" );

		if ( !ctx.loggedInUser ) {
			logger.error( "User Not Logged In!" );
			throw new TRPCError( { code: "UNAUTHORIZED", message: Messages.USER_NOT_LOGGED_IN } );
		}

		if ( !ctx.currentGame ) {
			logger.error( "Game Not Present!" );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		if ( !ctx.currentGame.players[ ctx.loggedInUser.id ] ) {
			logger.trace( "Game: %o", ctx.currentGame );
			logger.error( "Logged In User not part of this game! UserId: %s", ctx.loggedInUser.id );
			throw new TRPCError( { code: "FORBIDDEN", message: Messages.NOT_PART_OF_GAME } );
		}

		return next( { ctx } );
	};
}