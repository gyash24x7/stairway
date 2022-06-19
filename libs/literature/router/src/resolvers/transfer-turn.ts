import type { LitMoveDataWithoutDescription, LitResolver } from "../types";
import { Messages } from "../constants"
import type { TransferTurnInput } from "@s2h/literature/dtos";
import type { EnhancedLitGame } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { LitGameStatus, LitMoveType } from "@prisma/client";


const transferTurnResolver: LitResolver<TransferTurnInput> = async ( { input, ctx } ) => {
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];

	if ( game.loggedInPlayer?.hand.length !== 0 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_TRANSFER } );
	}

	if ( game.myTeam!.membersWithCards.length === 0 && game.oppositeTeam!.membersWithCards.length === 0 ) {
		await ctx.prisma.litGame.update( {
			where: { id: input.gameId },
			data: { status: LitGameStatus.COMPLETED }
		} );

		game.status = LitGameStatus.COMPLETED;

		ctx.litGamePublisher?.publish( game );
		return game;
	}

	const nextPlayer = game.myTeam!.membersWithCards.length === 0
		? game.oppositeTeam!.membersWithCards[ 0 ]
		: game.myTeam!.membersWithCards[ 0 ];

	const transferTurnMoveData: LitMoveDataWithoutDescription = {
		type: LitMoveType.TURN, turnId: nextPlayer.id, gameId: game.id
	};

	const transferTurnMove = await ctx.prisma.litMove.create( {
		data: { ...transferTurnMoveData, description: game.getNewMoveDescription( transferTurnMoveData ) }
	} );

	game.addMove( transferTurnMove );

	ctx.litGamePublisher?.publish( game );
	return game;
};

export default transferTurnResolver;
