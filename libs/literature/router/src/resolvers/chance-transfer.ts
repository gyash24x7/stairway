import { CardHand } from "@s2h/cards";
import type { ChanceTransferInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame, LiteratureMoveType } from "@s2h/literature/utils";
import { logger } from "@s2h/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";

async function validate( ctx: LiteratureTrpcContext, input: ChanceTransferInput ) {
	const game = LiteratureGame.from( ctx.currentGame! );
	const lastMove = await ctx.db.moves().findOne( {
		gameId: game.id,
		moveType: LiteratureMoveType.CALL_SET,
		action: { callData: { by: ctx.loggedInUser?.id } }
	} );

	if ( !lastMove?.success ) {
		logger.error( "Chance can only be transferred after successful call!" );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_CHANCE_TRANSFER } );
	}

	const givingPlayer = game.players[ ctx.loggedInUser!.id ];
	const receivingPlayer = game.players[ input.transferTo ];
	const receivingPlayerHand = CardHand.from( ctx.currentGameHands![ receivingPlayer.id ] );

	if ( !receivingPlayer ) {
		logger.error( "Cannot transfer chance to unknown player!" );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
	}

	if ( receivingPlayerHand.length === 0 ) {
		logger.error( "Chance can only be transferred to a player with cards!" );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CHANCE_TRANSFER_TO_PLAYER_WITH_CARDS } );
	}

	if ( receivingPlayer.teamId !== givingPlayer.teamId ) {
		logger.error( "Chance can only be transferred to member of your team!" );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CHANCE_TRANSFER_TO_SAME_TEAM_PLAYER } );
	}

	return [ game, givingPlayer ] as const;
}

export function chanceTransfer(): LiteratureResolver<ChanceTransferInput, ILiteratureGame> {
	return async ( { input, ctx } ) => {
		logger.debug( ">> chanceTransfer()" );
		logger.debug( "Input: %o", input );

		const [ game, givingPlayer ] = await validate( ctx, input );
		game.executeChanceTransferMove( { to: input.transferTo, from: givingPlayer.id } );

		await ctx.db.games().updateOne( { id: game.id }, game.serialize() );
		return game;
	};
}
