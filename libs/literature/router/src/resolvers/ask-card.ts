import { CardHand, PlayingCard } from "@s2h/cards";
import type { AskCardInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { db, LiteratureGame } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";

function validate( ctx: LiteratureTrpcContext, input: AskCardInput ) {
	const askingPlayer = ctx.currentGame!.players[ ctx.loggedInUser!.id ];
	const askedPlayer = ctx.currentGame!.players[ input.askedFrom ];

	if ( !askedPlayer ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
	}

	if ( askingPlayer.team! === askedPlayer.team! ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_ASK_FROM_YOUR_TEAM } );
	}

	const askedCard = PlayingCard.from( input.askedFor );
	if ( CardHand.from( askingPlayer.hand! ).contains( askedCard ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_ASK_CARD_THAT_YOU_HAVE } );
	}

	return [ LiteratureGame.from( ctx.currentGame! ) ] as const;
}

export function askCard(): LiteratureResolver<AskCardInput, ILiteratureGame> {
	return async ( { input, ctx } ) => {
		const [ game ] = validate( ctx, input );
		game.executeMoveAction( {
			action: "ASK",
			askData: { by: ctx.loggedInUser!.id, from: input.askedFrom, card: input.askedFor }
		} );

		await db.literature().get( input.gameId ).update( game.serialize() ).run( ctx.connection );
		return game;
	};
}