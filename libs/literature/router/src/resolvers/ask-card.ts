import { LitMoveType } from "@prisma/client";
import type { AskCardInput } from "@s2h/literature/dtos";
import type { LitResolverOptions, LitTrpcContext } from "../types";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import { PlayingCard } from "@s2h/cards";
import type { IEnhancedLitGame } from "@s2h/literature/utils";

function validate( ctx: LitTrpcContext, input: AskCardInput ) {
    if ( !ctx.currentGame!.playerData[ input.askedFrom ] ) {
        throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
    }

    if ( ctx.currentGame!.myTeam!.id === ctx.currentGame!.playerData[ input.askedFrom ].teamId ) {
        throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_ASK_FROM_YOUR_TEAM } );
    }

    const askedCard = PlayingCard.from( input.askedFor );
    if ( ctx.currentGame!.loggedInPlayer!.hand.contains( askedCard ) ) {
        throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_ASK_CARD_THAT_YOU_HAVE } );
    }

    return [ ctx.currentGame!, askedCard ] as const;
}

export default async function ( {
    input,
    ctx
}: LitResolverOptions<AskCardInput> ): Promise<IEnhancedLitGame> {
    const [ game, askedCard ] = validate( ctx, input );

    const askMove = await ctx.prisma.litMove.create( {
        data: game.getNewMoveData( {
            type: LitMoveType.ASK,
            askedFor: askedCard,
            askedFrom: game.playerData[ input.askedFrom ],
            askedBy: game.loggedInPlayer!
        } )
    } );

    game.addMove( askMove );
    ctx.litGamePublisher.publish( game );
    return game;
};