import { LitMoveType } from "@prisma/client";
import { PlayingCard } from "@s2h/cards";
import type { GiveCardInput } from "@s2h/literature/dtos";
import type { IEnhancedLitGame } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolverOptions, LitTrpcContext } from "../types";

function validate( ctx: LitTrpcContext, input: GiveCardInput ) {
	const cardToGive = PlayingCard.from( input.cardToGive );
	const givingPlayer = ctx.currentGame!.loggedInPlayer!;
	const takingPlayer = ctx.currentGame!.playerData[ input.giveTo ];

	if ( !takingPlayer ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
	}

	if ( takingPlayer.teamId === givingPlayer.teamId ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_GIVE_CARD_WITHIN_YOUR_TEAM } );
	}

	if ( !givingPlayer.hand.contains( cardToGive ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GIVE_CARD } );
	}

	return [ ctx.currentGame!, givingPlayer, takingPlayer, cardToGive ] as const;
}

export default async function ( { input, ctx }: LitResolverOptions<GiveCardInput> ): Promise<IEnhancedLitGame> {
	const [ game, givingPlayer, takingPlayer, cardToGive ] = validate( ctx, input );

	givingPlayer.hand.removeCard( cardToGive );
	takingPlayer.hand.addCard( cardToGive );

	const updatedPlayers = await Promise.all(
		[
			ctx.prisma.litPlayer.update( {
				where: { id: givingPlayer.id },
				data: { hand: givingPlayer.hand.serialize() }
			} ),
			ctx.prisma.litPlayer.update( {
				where: { id: takingPlayer.id },
				data: { hand: takingPlayer.hand.serialize() }
			} )
		]
	);

	game.handlePlayerUpdate( ...updatedPlayers );

	const giveCardMove = await ctx.prisma.litMove.create( {
		data: game.getNewMoveData( { type: LitMoveType.GIVEN, takingPlayer, givingPlayer, card: cardToGive } )
	} );

	game.addMove( giveCardMove );

	ctx.litGamePublisher.publish( game );
	return game;
};