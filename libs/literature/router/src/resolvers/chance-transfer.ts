import type { ChanceTransferInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame } from "@s2h/literature/utils";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { logger } from "@s2h/utils";

function validate( ctx: LiteratureTrpcContext, input: ChanceTransferInput ) {
	const game = LiteratureGame.from( ctx.currentGame! );
	const lastMove = game.moves[ 0 ];

	if ( lastMove.resultData.result !== "CALL_SET" || !lastMove.resultData.success ) {
		logger.error( "Chance can only be transferred after successful call!" );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_CHANCE_TRANSFER } );
	}

	const givingPlayer = game.players[ ctx.loggedInUser!.id ];
	const receivingPlayer = game.players[ input.transferTo ];

	if ( !receivingPlayer ) {
		logger.error( "Cannot transfer chance to unknown player!" );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
	}

	if ( receivingPlayer.hand.length === 0 ) {
		logger.error( "Chance can only be transferred to a player with cards!" );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CHANCE_TRANSFER_TO_PLAYER_WITH_CARDS } );
	}

	if ( receivingPlayer.team !== givingPlayer.team ) {
		logger.error( "Chance can only be transferred to member of your team!" );
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CHANCE_TRANSFER_TO_SAME_TEAM_PLAYER } );
	}

	return [ game ] as const;
}

export function chanceTransfer(): LiteratureResolver<ChanceTransferInput, ILiteratureGame> {
	return async ( { input, ctx } ) => {
		logger.debug( ">> chanceTransfer()" );
		logger.debug( "Input: %o", input );

		const [ game ] = validate( ctx, input );

		game.executeMoveAction( {
			action: "CHANCE_TRANSFER",
			transferData: {
				playerId: input.transferTo
			}
		} );

		await ctx.db.literature().get( game.id ).update( game.serialize() ).run( ctx.connection );
		return game;
	};
}
