import type { ChanceTransferInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGameStatus } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolverOptions, LitTrpcContext } from "../types";

function validate( ctx: LitTrpcContext ) {
	if ( ctx.currentGame!.loggedInPlayer!.hand.length !== 0 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_TRANSFER } );
	}

	return [ ctx.currentGame! ] as const;
}

export async function chanceTransfer( {
										  input,
										  ctx
									  }: LitResolverOptions<ChanceTransferInput> ): Promise<ILiteratureGame> {
	const [ game ] = validate( ctx );

	if ( game.myTeam!.membersWithCards.length === 0 && game.oppositeTeam!.membersWithCards.length === 0 ) {
		await ctx.prisma.litGame.update( {
			where: { id: input.gameId },
			data: { status: LiteratureGameStatus.COMPLETED }
		} );

		game.status = LiteratureGameStatus.COMPLETED;

		ctx.litGamePublisher.publish( game );
		return game;
	}

	const nextPlayer = game.myTeam!.membersWithCards.length === 0
		? game.oppositeTeam!.membersWithCards[ 0 ]
		: game.myTeam!.membersWithCards[ 0 ];

	const transferTurnMove = await ctx.prisma.litMove.create( {
		data: game.getNewMoveData( { type: LitMoveType.TURN, turnPlayer: nextPlayer } )
	} );

	game.addMove( transferTurnMove );

	ctx.litGamePublisher.publish( game );
	return game;
}
