import { LitMoveType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { PlayingCard } from "@s2h/cards";
import type { LitMoveDataWithoutDescription, LitResolver } from "../types";
import { Messages } from "../constants"
import type { CallSetInput } from "@s2h/literature/dtos";
import type { EnhancedLitGame } from "@s2h/literature/utils";

function includesAll<T>( arr: T[], subset: T[] ) {
	let flag = 0;
	subset.forEach( entry => {
		if ( arr.includes( entry ) ) {
			flag++;
		}
	} );
	return subset.length === flag;
}

const callSetResolver: LitResolver<CallSetInput> = async ( { input, ctx } ) => {
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];

	const cardsCalled = Object.values( input.data ).flat().map( PlayingCard.from );
	const cardSets = Array.from( new Set( cardsCalled.map( card => card.set ) ) );

	if ( cardSets.length !== 1 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_CARDS_OF_SAME_SET } );
	}

	if ( cardsCalled.length !== 6 ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_ALL_CARDS } );
	}

	if ( !includesAll( game.myTeam!.members.map( player => player.id ), Object.keys( input.data ) ) ) {
		throw new TRPCError( { code: "BAD_REQUEST", message: Messages.CALL_WITHIN_YOUR_TEAM } );
	}

	const callMoveData: LitMoveDataWithoutDescription = {
		type: LitMoveType.CALL,
		callingSet: cardSets[ 0 ],
		turnId: game.loggedInPlayer!.id,
		gameId: input.gameId
	};

	const callMove = await ctx.prisma.litMove.create( {
		data: { ...callMoveData, description: game.getNewMoveDescription( callMoveData ) }
	} );

	game.addMove( callMove );

	let cardsCalledCorrect = 0;
	game.myTeam!.members.forEach( ( { id, hand } ) => {
		const cardsCalledForPlayer = input.data[ id ].map( PlayingCard.from );
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

		const callSuccessMoveData: LitMoveDataWithoutDescription = {
			type: LitMoveType.CALL_SUCCESS, turnId: game.loggedInPlayer!.id, gameId: input.gameId
		};

		const callSuccessMove = await ctx.prisma.litMove.create( {
			data: { ...callSuccessMoveData, description: game.getNewMoveDescription( callSuccessMoveData ) }
		} );

		game.addMove( callSuccessMove );
	} else {
		const oppositeTeam = await ctx.prisma.litTeam.update( {
			where: { id: game.oppositeTeam!.members[ 0 ].teamId! },
			data: { score: { increment: 1 } }
		} );

		game.handleTeamUpdate( oppositeTeam );

		const callFailMoveData: LitMoveDataWithoutDescription = {
			type: LitMoveType.CALL_FAIL, turnId: game.oppositeTeam!.membersWithCards[ 0 ].id, gameId: input.gameId
		};

		const callFailMove = await ctx.prisma.litMove.create( {
			data: { ...callFailMoveData, description: game.getNewMoveDescription( callFailMoveData ) }
		} );

		game.addMove( callFailMove );
	}

	const handData = game.removeCardsOfSetFromGameAndGetUpdatedHands( cardSets[ 0 ] );

	const updatedPlayers = await Promise.all(
		Object.keys( handData ).map( playerId =>
			ctx.prisma.litPlayer.update( {
				where: { id: playerId },
				data: { hand: handData[ playerId ].serialize() }
			} )
		)
	);

	game.handlePlayerUpdate( ...updatedPlayers );

	ctx.litGamePublisher?.publish( game );
	return game;
};

export default callSetResolver;