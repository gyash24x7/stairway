import { TRPCError } from "@trpc/server";
import type { TrpcMiddleware } from "@s2h/utils";
import { getGameInputStruct } from "@s2h/literature/dtos";
import { EnhancedLitGame } from "@s2h/literature/utils";
import type { LitGameData } from "../types";
import { Messages } from "../constants";

const requireGame: TrpcMiddleware = async function ( { ctx, rawInput, next } ) {
	const result = getGameInputStruct.safeParse( rawInput );

	if ( !result.success ) {
		console.error( result.error );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Invalid Game ID!" } );
	}

	const game: LitGameData | null = await ctx.prisma.litGame.findUnique( {
		where: { id: result.data.gameId },
		include: { players: true, moves: true, teams: true }
	} );

	if ( !game ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	ctx.res!.locals[ "currentGame" ] = EnhancedLitGame.from( game );
	return next();
};

export default requireGame;