import type { LitResolverOptions, LitTrpcContext } from "../types";
import { Messages } from "../constants"
import type { DeclineCardInput } from "@s2h/literature/dtos";
import { PlayingCard } from "@s2h/cards";
import { TRPCError } from "@trpc/server";
import { LitMoveType } from "@prisma/client";

function validate( ctx: LitTrpcContext, input: DeclineCardInput ) {
	const cardDeclined = PlayingCard.from( input.cardDeclined );

	if ( ctx.currentGame!.loggedInPlayer!.hand.contains( cardDeclined ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_DECLINE_CARD } );
	}

	return [ ctx.currentGame!, cardDeclined ] as const;
}

export default async function ( { ctx, input }: LitResolverOptions<DeclineCardInput> ) {
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