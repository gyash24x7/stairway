import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { LitTrpcMiddleware } from "../types";

export function requirePlayer(): LitTrpcMiddleware {
	return async ( { ctx, next } ) => {
		if ( !ctx.loggedInUser ) {
			throw new TRPCError( { code: "UNAUTHORIZED", message: Messages.USER_NOT_LOGGED_IN } );
		}

		if ( !ctx.currentGame ) {
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		if ( !ctx.currentGame.players[ ctx.loggedInUser.id ] ) {
			throw new TRPCError( { code: "FORBIDDEN", message: Messages.NOT_PART_OF_GAME } );
		}

		return next( { ctx } );
	};
}