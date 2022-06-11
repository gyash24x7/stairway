import type { LitMoveDataWithoutDescription, LitResolver } from "@s2h/utils";
import { Messages } from "@s2h/utils";
import type { DeclineCardInput } from "@s2h/literature/dtos";
import type { EnhancedLitGame } from "@s2h/literature/utils";
import { PlayingCard } from "@s2h/cards";
import { TRPCError } from "@trpc/server";
import { LitMoveType } from "@prisma/client";

const declineCardResolver: LitResolver<DeclineCardInput> = async ( { ctx, input } ) => {
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];

	const cardDeclined = PlayingCard.from( input.cardDeclined );

	if ( game.loggedInPlayer?.hand.contains( cardDeclined ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_DECLINE_CARD } );
	}

	const declineMoveData: LitMoveDataWithoutDescription = {
		type: LitMoveType.DECLINED, turnId: game.loggedInPlayer?.id, gameId: input.gameId
	};

	const declineMove = await ctx.prisma.litMove.create( {
		data: { ...declineMoveData, description: game.getNewMoveDescription( declineMoveData ) }
	} );

	game.addMove( declineMove );
	ctx.litGamePublisher?.publish( game );
	return game;
};

export default declineCardResolver;