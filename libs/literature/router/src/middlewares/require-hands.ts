import { LiteratureTrpcMiddleware } from "@s2h/literature/router";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { logger } from "@s2h/utils";
import { ICardHand } from "@s2h/cards";

export function requireHands(): LiteratureTrpcMiddleware {
	return async ( { ctx, next } ) => {
		logger.debug( ">> requireHands()" );

		if ( !ctx.loggedInUser ) {
			logger.error( "User Not Logged In!" );
			throw new TRPCError( { code: "UNAUTHORIZED", message: Messages.USER_NOT_LOGGED_IN } );
		}

		if ( !ctx.currentGame ) {
			logger.error( "Game Not Present!" );
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		const hands = await ctx.db.hands().find( { gameId: ctx.currentGame.id } );
		const currentGameHands: Record<string, ICardHand> = {};

		let handCount = 0;
		for await ( const hand of hands ) {
			currentGameHands[ hand.playerId ] = hand.hand;
			handCount++;
		}

		if ( handCount !== 6 ) {
			logger.trace( "Game: %o", ctx.currentGame );
			logger.error( "Hands Not Present! GameId: %s", ctx.currentGame.id );
			throw new TRPCError( { code: "FORBIDDEN", message: Messages.HANDS_NOT_PRESENT } );
		}

		return next( { ctx: { ...ctx, currentGameHands } } );
	};
}