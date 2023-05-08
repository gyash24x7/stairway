import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { LitTrpcMiddleware } from "../types";

const requirePlayer: LitTrpcMiddleware = async ( { ctx, next } ) => {
	if ( !ctx.loggedInUser ) {
		throw new TRPCError( { code: "UNAUTHORIZED", message: Messages.USER_NOT_LOGGED_IN } );
	}

	if ( !ctx.currentGame ) {
		throw new TRPCError( { code: "NOT_FOUND", message: Messages.GAME_NOT_FOUND } );
	}

	ctx.currentGame.loggedInUserId = ctx.loggedInUser.id;

	if ( !ctx.currentGame.loggedInPlayer ) {
		throw new TRPCError( { code: "FORBIDDEN", message: Messages.NOT_PART_OF_GAME } );
	}

	return next( { ctx } );
};

export default requirePlayer;