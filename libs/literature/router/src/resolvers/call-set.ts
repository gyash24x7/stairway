import { LitMoveType } from "@prisma/client";
import { PlayingCard } from "@s2h/cards";
import type { CallSetInput } from "@s2h/literature/dtos";
import type { IEnhancedLitGame } from "@s2h/literature/utils";
import { TRPCError } from "@trpc/server";
import { Messages } from "../constants";
import type { LitResolverOptions, LitTrpcContext } from "../types";

function validate( ctx: LitTrpcContext, input: CallSetInput ) {
	const calledCards = Object.values( input.data ).flat().map( PlayingCard.from );
	const calledCardIds = new Set( calledCards.map( card => card.id ) );
	const cardSets = new Set( calledCards.map( card => card.set ) );

	const calledPlayers = Object.keys( input.data ).map( playerId => {
		const player = ctx.currentGame!.playerData[ playerId ];
		if ( !player ) {
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.PLAYER_NOT_FOUND } );
		}
		return player;
	} );

	if ( !Object.keys( input.data ).includes( ctx.currentGame!.loggedInPlayer!.id ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_CALL } );
	}

	if ( calledCardIds.size !== calledCards.length ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.DUPLICATES_IN_CALL } );
	}

	if ( cardSets.size !== 1 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_CARDS_OF_SAME_SET } );
	}

	const [ callingSet ] = cardSets;

	if ( !ctx.currentGame!.loggedInPlayer!.hand.cardSetsInHand.includes( callingSet ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CANNOT_CALL_SET_THAT_YOU_DONT_HAVE } );
	}

	const calledTeamIds = new Set( calledPlayers.map( player => player.teamId ) );

	if ( calledTeamIds.size !== 1 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_WITHIN_YOUR_TEAM } );
	}

	if ( calledCards.length !== 6 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_ALL_CARDS } );
	}

	return [ ctx.currentGame!, callingSet ] as const;
}

export default async function ( { input, ctx }: LitResolverOptions<CallSetInput> ): Promise<IEnhancedLitGame> {
	const [ game, callingSet ] = validate( ctx, input );

	let cardsCalledCorrect = 0;
	game.myTeam!.members.forEach( ( { id, hand } ) => {
		const cardsCalledForPlayer = input.data[ id ]?.map( PlayingCard.from );
		if ( !!cardsCalledForPlayer ) {
			if ( hand.containsAll( cardsCalledForPlayer ) ) {
				cardsCalledCorrect += cardsCalledForPlayer.length;
			}
		}
	} );

	if ( cardsCalledCorrect === 6 ) {
		const myTeam = await ctx.prisma.litTeam.update( {
			where: { id: game.loggedInPlayer!.teamId! },
			data: { score: { increment: 1 } }
		} );

		game.handleTeamUpdate( myTeam );

		const callSuccessMove = await ctx.prisma.litMove.create( {
			data: game.getNewMoveData( {
				type: LitMoveType.CALL_SUCCESS,
				turnPlayer: game.loggedInPlayer!,
				cardSet: callingSet
			} )
		} );

		game.addMove( callSuccessMove );

	} else {
		const oppositeTeam = await ctx.prisma.litTeam.update( {
			where: { id: game.oppositeTeam!.members[ 0 ].teamId! },
			data: { score: { increment: 1 } }
		} );

		game.handleTeamUpdate( oppositeTeam );

		const callFailMove = await ctx.prisma.litMove.create( {
			data: game.getNewMoveData( {
				type: LitMoveType.CALL_FAIL,
				turnPlayer: game.oppositeTeam!.membersWithCards[ 0 ],
				cardSet: callingSet,
				callingPlayer: game.loggedInPlayer
			} )
		} );

		game.addMove( callFailMove );
	}

	const handData = game.removeCardsOfSetFromGameAndGetUpdatedHands( callingSet );

	const updatedPlayers = await Promise.all(
		Object.keys( handData ).map( playerId =>
			ctx.prisma.litPlayer.update( {
				where: { id: playerId },
				data: { hand: handData[ playerId ].serialize() }
			} )
		)
	);

	game.handlePlayerUpdate( ...updatedPlayers );

	ctx.litGamePublisher.publish( game );
	return game;
};
