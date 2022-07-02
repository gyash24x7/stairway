import { TRPCError } from "@trpc/server";
import type { LitTrpcMiddlewareOptions } from "../types";
import { Messages } from "../constants";
import { LitGameStatus } from "@prisma/client";

export default async function ( { ctx, next }: LitTrpcMiddlewareOptions ) {
	if ( !ctx.currentGame ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	if ( ctx.currentGame.status !== LitGameStatus.IN_PROGRESS ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GAME_STATUS } );
	}

	return next( { ctx } );
};