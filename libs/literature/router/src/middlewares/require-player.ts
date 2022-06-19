import { TRPCError } from "@trpc/server";
import type { TrpcMiddleware } from "@s2h/utils";
import { Messages } from "../constants"
import type { EnhancedLitGame } from "@s2h/literature/utils";

const requirePlayer: TrpcMiddleware = async function ( { ctx, next } ) {
	const userId = ctx.res?.locals[ "userId" ] as string;
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];

	game.loggedInUserId = userId;

	if ( !game.loggedInPlayer ) {
		throw new TRPCError( { code: "FORBIDDEN", message: Messages.NOT_PART_OF_GAME } );
	}

	return next();
};

export default requirePlayer;