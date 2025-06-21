import type { AuthInfo } from "@/auth/types";
import type { DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "@/callbreak/server/inputs";
import * as repository from "@/callbreak/server/repository";
import type { Callbreak } from "@/callbreak/types";
import { getCardFromId } from "@/libs/cards/card";
import { isCardInHand } from "@/libs/cards/hand";
import { getBestCardPlayed, getPlayableCards } from "@/libs/cards/utils";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "Callbreak:Validators" );

export async function validateJoinGame( input: JoinGameInput, { id }: AuthInfo ) {
	logger.debug( ">> validateJoinGame()" );

	const game = await repository.getGameByCode( input.code );
	if ( !game ) {
		logger.error( "Game Not Found: %s", input.code );
		throw "Game Not Found!";
	}

	if ( game.players.find( player => player.id === id ) ) {
		logger.warn( "Player Already Joined: %s", id );
		return { alreadyJoined: true, game };
	}

	if ( game.players.length >= 4 ) {
		logger.error( "Game Full: %s", game.id );
		throw "Game Full!";
	}

	logger.debug( "<< validateJoinGame()" );
	return { alreadyJoined: false, game };
}

export async function validateAddBots( game: Callbreak.Game, players: Callbreak.PlayerData ) {
	logger.debug( ">> validateAddBots()" );

	const botCount = 4 - Object.keys( players ).length;

	if ( botCount <= 0 ) {
		logger.error( "Game Full: %s", game.id );
		throw "Game Full!";
	}

	logger.debug( "<< validateAddBots()" );
	return botCount;
}

export async function validateDealWinDeclaration( input: DeclareDealWinsInput ) {
	logger.debug( ">> validateDealWinDeclaration()" );

	const deal = await repository.getActiveDeal( input.gameId );
	if ( !deal ) {
		logger.error( "Active Deal Not Found: %s", input.gameId );
		throw "Deal Not Found!";
	}

	if ( deal.playerOrder[ deal.turnIdx ] !== input.playerId ) {
		logger.error( "Not Your Turn: %s", input.playerId );
		throw "Not Your Turn!";
	}

	logger.debug( "<< validateDealWinDeclaration()" );
	return deal;
}

export async function validatePlayCard( input: PlayCardInput, game: Callbreak.Game ) {
	logger.debug( ">> validatePlayCard()" );

	const playedCard = getCardFromId( input.cardId );

	const round = await repository.getActiveRound( input.dealId, game.id );
	if ( !round ) {
		logger.error( "Round Not Found: %s", input.roundId );
		throw "Round Not Found!";
	}

	if ( round.playerOrder[ round.turnIdx ] !== input.playerId ) {
		logger.error( "Not Your Turn: %s", input.playerId );
		throw "Not Your Turn!";
	}

	const cardMappings = await repository.getCardMappingsForPlayer( input.dealId, game.id, input.playerId );
	const hand = cardMappings.map( mapping => getCardFromId( mapping.cardId ) );

	if ( !isCardInHand( hand, playedCard ) ) {
		logger.error( "Card Not Yours: %s", input.cardId );
		throw "Card Not Yours!";
	}

	const cardsPlayedInRound = Object.values( round.cards ).map( getCardFromId );
	const greatestCardPlayed = getBestCardPlayed( cardsPlayedInRound, game.trumpSuit, round.suit );
	const playableCards = getPlayableCards( hand, game.trumpSuit, greatestCardPlayed, round.suit );

	if ( !isCardInHand( playableCards, playedCard ) ) {
		logger.error( "Invalid Card: %s", input.cardId );
		throw "Invalid Card!";
	}

	logger.debug( "<< validatePlayCard()" );
	return { round, hand, playableCards };
}