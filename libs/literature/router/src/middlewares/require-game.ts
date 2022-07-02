import { TRPCError } from "@trpc/server";
import { getGameInputStruct } from "@s2h/literature/dtos";
import { EnhancedLitGame } from "@s2h/literature/utils";
import type { LitGameData, LitTrpcMiddlewareOptions } from "../types";
import { Messages } from "../constants";

export default async function ( { ctx, rawInput, next }: LitTrpcMiddlewareOptions ) {
	const result = getGameInputStruct.safeParse( rawInput );

	if ( !result.success ) {
		console.error( result.error );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_ID } );
	}

	const game: LitGameData | null = await ctx.prisma.litGame.findUnique( {
		where: { id: result.data.gameId },
		include: { players: true, moves: true, teams: true }
	} );

	if ( !game ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	const currentGame = EnhancedLitGame.from( game );
	return next( { ctx: { ...ctx, currentGame } } );
};