import { LitMoveType } from "@prisma/client";
import { PlayingCard } from "@s2h/cards";
import type { DeclineCardInput } from "@s2h/literature/dtos";
import type { IEnhancedLitGame } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolverOptions, LitTrpcContext } from "../types";

function validate( ctx: LitTrpcContext, input: DeclineCardInput ) {
	const cardDeclined = PlayingCard.from( input.cardDeclined );

	if ( ctx.currentGame!.loggedInPlayer!.hand.contains( cardDeclined ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_DECLINE_CARD } );
	}

	return [ ctx.currentGame!, cardDeclined ] as const;
}

export default async function ( { ctx, input }: LitResolverOptions<DeclineCardInput> ): Promise<IEnhancedLitGame> {
	const [ game, cardDeclined ] = validate( ctx, input );

	const declineMove = await ctx.prisma.litMove.create( {
		data: game.getNewMoveData( {
			type: LitMoveType.DECLINED,
			declinedPlayer: game.loggedInPlayer!,
			askingPlayer: game.playerData[ game.moves[ 0 ].askedById! ],
			card: cardDeclined
		} )
	} );

	game.addMove( declineMove );
	ctx.litGamePublisher.publish( game );
	return game;
};