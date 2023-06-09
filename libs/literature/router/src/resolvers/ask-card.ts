import { CardHand, PlayingCard } from "@s2h/cards";
import type { AskCardInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import { LiteratureGame, LiteratureMove } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LiteratureResolver, LiteratureTrpcContext } from "../utils";

function validate( ctx: LiteratureTrpcContext, input: AskCardInput ) {
	const game = LiteratureGame.from( ctx.currentGame! );
	const hands: Record<string, CardHand> = {};
	Object.keys( ctx.currentGameHands! ).map( playerId => {
		hands[ playerId ] = CardHand.from( ctx.currentGameHands![ playerId ] );
	} );

	const askingPlayer = game.players[ ctx.loggedInUser!.id ];
	const askedPlayer = game.players[ input.askedFrom ];
	const askingPlayerHand = CardHand.from( ctx.currentGameHands![ askingPlayer.id ] );

	if ( !askedPlayer ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
	}

	if ( askingPlayer.teamId! === askedPlayer.teamId! ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_ASK_FROM_YOUR_TEAM } );
	}

	const askedCard = PlayingCard.from( input.askedFor );
	if ( askingPlayerHand.contains( askedCard ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_ASK_CARD_THAT_YOU_HAVE } );
	}

	return [ game, hands ] as const;
}

export function askCard(): LiteratureResolver<AskCardInput, ILiteratureGame> {
	return async ( { input, ctx } ) => {
		const [ game, hands ] = validate( ctx, input );

		const askData = { by: ctx.loggedInUser!.id, from: input.askedFrom, card: input.askedFor };
		const updatedHands = game.executeAskMove( askData, hands );
		const move = LiteratureMove.createAskMove( game.id, askData, !!updatedHands );

		await ctx.db.moves().insertOne( move.serialize() );

		if ( !!updatedHands ) {
			await Promise.all( Object.keys( updatedHands ).map( playerId => ctx.db.hands().updateOne(
				{ gameId: game.id, playerId },
				updatedHands[ playerId ].serialize()
			) ) );
		}

		await ctx.db.games().updateOne( { id: game.id }, game.serialize() );
		return game;
	};
}