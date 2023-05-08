import { LitGameStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { LitTrpcMiddleware } from "../types";

const requireGameInProgress: LitTrpcMiddleware = async ( { ctx, next } ) => {
	if ( !ctx.currentGame ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	if ( ctx.currentGame.status !== LitGameStatus.IN_PROGRESS ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	return next( { ctx } );
};

export default requireGameInProgress;