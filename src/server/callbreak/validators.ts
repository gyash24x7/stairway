import { getCardFromId } from "@/libs/cards/card";
import { isCardInHand } from "@/libs/cards/hand";
import { getBestCardPlayed, getPlayableCards } from "@/libs/cards/utils";
import type { DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "@/server/callbreak/inputs";
import { createLogger } from "@/server/utils/logger";
import { prisma } from "@/server/utils/prisma";
import type { Auth } from "@/types/auth";
import type { Callbreak } from "@/types/callbreak";
import { ORPCError } from "@orpc/server";

const logger = createLogger( "CallbreakValidators" );

export async function validateJoinGame( input: JoinGameInput, { id }: Auth.Info ) {
	logger.debug( ">> validateJoinGame()" );

	const game = await prisma.callbreak.game.findUnique( {
		where: { code: input.code },
		include: { players: true }
	} );

	if ( !game ) {
		logger.error( "Game Not Found: %s", input.code );
		throw new ORPCError( "NOT_FOUND", { message: "Game Not Found!" } );
	}

	if ( game.players.find( player => player.id === id ) ) {
		logger.warn( "Player Already Joined: %s", id );
		return { alreadyJoined: true, game };
	}

	if ( game.players.length >= 4 ) {
		logger.error( "Game Full: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "Game Full!" } );
	}

	logger.debug( "<< validateJoinGame()" );
	return { alreadyJoined: false, game };
}

export async function validateAddBots( game: Callbreak.Game, players: Callbreak.PlayerData ) {
	logger.debug( ">> validateAddBots()" );

	const botCount = 4 - Object.keys( players ).length;

	if ( botCount <= 0 ) {
		logger.error( "Game Full: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "Game Full!" } );
	}

	logger.debug( "<< validateAddBots()" );
	return botCount;
}

export async function validateDealWinDeclaration( input: DeclareDealWinsInput, game: Callbreak.Game ) {
	logger.debug( ">> validateDealWinDeclaration()" );

	const deal = await prisma.callbreak.deal.findUnique( {
		where: { id_gameId: { id: input.dealId, gameId: game.id } },
		include: { rounds: true }
	} );

	if ( !deal ) {
		logger.error( "Deal Not Found: %s", input.dealId );
		throw new ORPCError( "NOT_FOUND", { message: "Deal Not Found!" } );
	}

	if ( deal.playerOrder[ deal.turnIdx ] !== input.playerId ) {
		logger.error( "Not Your Turn: %s", input.playerId );
		throw new ORPCError( "BAD_REQUEST", { message: "Not Your Turn!" } );
	}

	logger.debug( "<< validateDealWinDeclaration()" );
	return deal;
}

export async function validatePlayCard( input: PlayCardInput, game: Callbreak.Game ) {
	logger.debug( ">> validatePlayCard()" );

	const playedCard = getCardFromId( input.cardId );

	const round = await prisma.callbreak.round.findUnique( {
		where: {
			id_dealId_gameId: { id: input.roundId, gameId: game.id, dealId: input.dealId },
			completed: false
		}
	} );

	if ( !round ) {
		logger.error( "Round Not Found: %s", input.roundId );
		throw new ORPCError( "NOT_FOUND", { message: "Round Not Found!" } );
	}

	if ( round.playerOrder[ round.turnIdx ] !== input.playerId ) {
		logger.error( "Not Your Turn: %s", input.playerId );
		throw new ORPCError( "BAD_REQUEST", { message: "Not Your Turn!" } );
	}

	const cardMappings = await prisma.callbreak.cardMapping.findMany( {
		where: { dealId: input.dealId, gameId: game.id, playerId: input.playerId }
	} );

	const hand = cardMappings.map( mapping => getCardFromId( mapping.cardId ) );

	if ( !isCardInHand( hand, playedCard ) ) {
		logger.error( "Card Not Yours: %s", input.cardId );
		throw new ORPCError( "BAD_REQUEST", { message: "Card Not Yours!" } );
	}

	const cardsPlayedInRound = Object.values( round.cards ).map( getCardFromId );
	const greatestCardPlayed = getBestCardPlayed( cardsPlayedInRound, game.trumpSuit, round.suit );
	const playableCards = getPlayableCards( hand, game.trumpSuit, greatestCardPlayed, round.suit );

	if ( !isCardInHand( playableCards, playedCard ) ) {
		logger.error( "Invalid Card: %s", input.cardId );
		throw new ORPCError( "BAD_REQUEST", { message: "Invalid Card!" } );
	}

	logger.debug( "<< validatePlayCard()" );
	return { round, hand, playableCards };
}