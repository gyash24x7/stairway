import type { LitResolverOptions, LitTrpcContext } from "../types";
import { Messages } from "../constants"
import type { TransferTurnInput } from "@s2h/literature/dtos";
import { TRPCError } from "@trpc/server";
import { LitGameStatus, LitMoveType } from "@prisma/client";
import type { IEnhancedLitGame } from "@s2h/literature/utils";

function validate( ctx: LitTrpcContext ) {
    if ( ctx.currentGame!.loggedInPlayer!.hand.length !== 0 ) {
        throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_TRANSFER } );
    }

    return [ ctx.currentGame! ] as const;
}

export default async function ( {
    input,
    ctx
}: LitResolverOptions<TransferTurnInput> ): Promise<IEnhancedLitGame> {
    const [ game ] = validate( ctx );

    if ( game.myTeam!.membersWithCards.length === 0 && game.oppositeTeam!.membersWithCards.length === 0 ) {
        await ctx.prisma.litGame.update( {
            where: { id: input.gameId },
            data: { status: LitGameStatus.COMPLETED }
        } );

        game.status = LitGameStatus.COMPLETED;

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
};
