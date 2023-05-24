import { LitTrpcMiddleware } from "@s2h/literature/router";
import { LiteratureGameStatus } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";

export function requireGameInProgress(): LitTrpcMiddleware {
	return async ( { ctx, next } ) => {
		if ( !ctx.currentGame ) {
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		if ( ctx.currentGame.status !== LiteratureGameStatus.IN_PROGRESS ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
		}

		return next( { ctx } );
	};
}