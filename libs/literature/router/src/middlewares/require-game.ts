import { getGameInput } from "@s2h/literature/dtos";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitTrpcMiddleware } from "../types";
import { r } from "../db";

export function requireGame(): LitTrpcMiddleware {
	return async ( { ctx, rawInput, next } ) => {

		const result = getGameInput.safeParse( rawInput );

		if ( !result.success ) {
			console.error( result.error );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_ID } );
		}

		const currentGame = await r.literature().get( result.data.gameId ).run( ctx.connection );
		if ( !currentGame ) {
			throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
		}

		return next( { ctx: { ...ctx, currentGame } } );
	};
}
