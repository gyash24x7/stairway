import { createLogger, prisma, type UserAuthInfo } from "@stairway/api/utils";
import { getBestCardPlayed, getCardFromId, getPlayableCards, isCardInHand } from "@stairway/cards";
import { TRPCError } from "@trpc/server";
import { format } from "node:util";
import type { DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "./inputs.ts";
import type { Game, PlayerData } from "./types.ts";

const logger = createLogger( "CallbreakValidators" );

export async function validateJoinGame( input: JoinGameInput, { id }: UserAuthInfo ) {
	logger.debug( ">> validateJoinGame()" );

	const game = await prisma.callbreak.game.findUnique( {
		where: { code: input.code },
		include: { players: true }
	} );

	if ( !game ) {
		logger.error( format( "Game Not Found: %s", input.code ) );
		throw new TRPCError( { code: "NOT_FOUND", message: "Game Not Found!" } );
	}

	if ( game.players.find( player => player.id === id ) ) {
		logger.warn( format( "Player Already Joined: %s", id ) );
		return { alreadyJoined: true, game };
	}

	if ( game.players.length >= 4 ) {
		logger.error( format( "Game Full: %s", game.id ) );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Game Full!" } );
	}

	logger.debug( "<< validateJoinGame()" );
	return { alreadyJoined: false, game };
}

export async function validateAddBots( game: Game, players: PlayerData ) {
	logger.debug( ">> validateAddBots()" );

	const botCount = 4 - Object.keys( players ).length;

	if ( botCount <= 0 ) {
		logger.error( format( "Game Full: %s", game.id ) );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Game Full!" } );
	}

	logger.debug( "<< validateAddBots()" );
	return botCount;
}

export async function validateDealWinDeclaration( input: DeclareDealWinsInput, game: Game, playerId: string ) {
	logger.debug( ">> validateDealWinDeclaration()" );

	const deal = await prisma.callbreak.deal.findUnique( {
		where: { id_gameId: { id: input.dealId, gameId: game.id } },
		include: { rounds: true }
	} );

	if ( !deal ) {
		logger.error( format( "Deal Not Found: %s", input.dealId ) );
		throw new TRPCError( { code: "NOT_FOUND", message: "Deal Not Found!" } );
	}

	if ( deal.playerOrder[ deal.turnIdx ] !== playerId ) {
		logger.error( format( "Not Your Turn: %s", playerId ) );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Not Your Turn!" } );
	}

	logger.debug( "<< validateDealWinDeclaration()" );
	return deal;
}

export async function validatePlayCard( input: PlayCardInput, game: Game, playerId: string ) {
	logger.debug( ">> validatePlayCard()" );

	const playedCard = getCardFromId( input.cardId );

	const round = await prisma.callbreak.round.findUnique( {
		where: {
			id_dealId_gameId: { id: input.roundId, gameId: game.id, dealId: input.dealId },
			completed: false
		}
	} );

	if ( !round ) {
		logger.error( format( "Round Not Found: %s", input.roundId ) );
		throw new TRPCError( { code: "NOT_FOUND", message: "Round Not Found!" } );
	}

	if ( round.playerOrder[ round.turnIdx ] !== playerId ) {
		logger.error( format( "Not Your Turn: %s", playerId ) );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Not Your Turn!" } );
	}

	const cardMappings = await prisma.callbreak.cardMapping.findMany( {
		where: { dealId: input.dealId, gameId: game.id, playerId }
	} );

	const hand = cardMappings.map( mapping => getCardFromId( mapping.cardId ) );

	if ( !isCardInHand( hand, playedCard ) ) {
		logger.error( format( "Card Not Yours: %s", input.cardId ) );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Card Not Yours!" } );
	}

	const cardsPlayedInRound = Object.values( round.cards ).map( getCardFromId );
	const greatestCardPlayed = getBestCardPlayed( cardsPlayedInRound, game.trumpSuit, round.suit );
	const playableCards = getPlayableCards( hand, game.trumpSuit, greatestCardPlayed, round.suit );

	if ( !isCardInHand( playableCards, playedCard ) ) {
		logger.error( format( "Invalid Card: %s", input.cardId ) );
		throw new TRPCError( { code: "BAD_REQUEST", message: "Invalid Card!" } );
	}

	logger.debug( "<< validatePlayCard()" );
	return { round, hand, playableCards };
}