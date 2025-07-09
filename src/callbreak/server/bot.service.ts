import type { Callbreak } from "@/callbreak/types";
import { CARD_RANKS, CARD_SUITS } from "@/libs/cards/constants";
import type { CardRank, CardSuit, PlayingCard } from "@/libs/cards/types";
import {
	compareCards,
	generateDeck,
	getBestCardPlayed,
	getCardFromId,
	getCardsOfSuit,
	getPlayableCards
} from "@/libs/cards/utils";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "CallbreakBotService" );

const BIG_RANKS: CardRank[] = [ CARD_RANKS.ACE, CARD_RANKS.KING, CARD_RANKS.QUEEN ];

export function suggestDealWins( hand: PlayingCard[], trumpSuit: CardSuit ) {
	logger.debug( ">> suggestDealWins()" );

	let possibleWins = 0;
	for ( const suit of Object.values( CARD_SUITS ) ) {
		const cards = getCardsOfSuit( suit, hand );
		const bigRanks = cards.filter( card => BIG_RANKS.includes( card.rank ) );

		if ( suit === trumpSuit ) {
			possibleWins += bigRanks.length;
			continue;
		}

		if ( cards.length >= 3 ) {
			possibleWins += Math.min( bigRanks.length, 2 );
		} else if ( cards.length === 2 ) {
			possibleWins += 1 + Math.min( bigRanks.length, 1 );
		} else {
			possibleWins += 2 + bigRanks.length;
		}
	}

	if ( possibleWins < 2 ) {
		possibleWins = 2;
	}

	logger.debug( "<< suggestDealWins()" );
	return possibleWins;
}

export function suggestCardToPlay(
	hand: PlayingCard[],
	activeRound: Callbreak.Round,
	cardsAlreadyPlayed: PlayingCard[],
	trumpSuit: CardSuit
) {
	logger.debug( ">> suggestCardToPlay()" );

	const cardsPlayedInActiveRound = Object.values( activeRound.cards ).map( getCardFromId );
	const bestCardInActiveRound = getBestCardPlayed( cardsPlayedInActiveRound, trumpSuit, activeRound.suit );
	const playableCards = getPlayableCards( hand, trumpSuit, bestCardInActiveRound, activeRound.suit );

	const deck = generateDeck();
	const unbeatableCards = playableCards.filter( card => {
		const greaterCards = deck.filter( deckCard => compareCards( deckCard, card ) );
		return greaterCards.every( greaterCard => cardsAlreadyPlayed.includes( greaterCard ) );
	} );

	const cardToPlay = unbeatableCards.length > 0
		? unbeatableCards[ Math.floor( Math.random() * unbeatableCards.length ) ]
		: playableCards[ Math.floor( Math.random() * playableCards.length ) ];

	logger.debug( "<< suggestCardToPlay()" );
	return cardToPlay;
}