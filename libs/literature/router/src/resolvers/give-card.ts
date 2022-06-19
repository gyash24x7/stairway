import type { LitMoveDataWithoutDescription, LitResolver } from "../types";
import { Messages } from "../constants"
import type { GiveCardInput } from "@s2h/literature/dtos";
import type { EnhancedLitGame } from "@s2h/literature/utils";
import { PlayingCard } from "@s2h/cards";
import { TRPCError } from "@trpc/server";
import { LitMoveType } from "@prisma/client";

const giveCardResolver: LitResolver<GiveCardInput> = async ( { input, ctx } ) => {
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];

	const cardToGive = PlayingCard.from( input.cardToGive );
	const givingPlayer = game.loggedInPlayer!;
	const takingPlayer = game.playerData[ input.giveTo ];

	if ( !takingPlayer ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
	}

	if ( !givingPlayer.hand.contains( cardToGive ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GIVE_CARD } );
	}

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

	const giveCardMoveData: LitMoveDataWithoutDescription = {
		type: LitMoveType.GIVEN, turnId: takingPlayer.id, gameId: input.gameId
	};

	const giveCardMove = await ctx.prisma.litMove.create( {
		data: { ...giveCardMoveData, description: game.getNewMoveDescription( giveCardMoveData ) }
	} );

	game.addMove( giveCardMove );

	ctx.litGamePublisher?.publish( game );
	return game;
};

export default giveCardResolver;