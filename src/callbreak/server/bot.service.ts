import type { Callbreak } from "@/callbreak/types";
import { compareCards, getCardFromId } from "@/libs/cards/card";
import { CARD_SUITS } from "@/libs/cards/constants";
import { generateDeck, getSuitGroupsFromHand } from "@/libs/cards/hand";
import { CardRank, CardSuit, type PlayingCard } from "@/libs/cards/types";
import { getBestCardPlayed, getPlayableCards } from "@/libs/cards/utils";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "CallbreakBotService" );

const BIG_RANKS = [ CardRank.ACE, CardRank.KING, CardRank.QUEEN ];

export function suggestDealWins( hand: PlayingCard[], trumpSuit: CardSuit ) {
	logger.debug( ">> suggestDealWins()" );

	const cardsBySuit = getSuitGroupsFromHand( hand );
	let possibleWins = 0;

	for ( const suit of CARD_SUITS ) {
		const cards = cardsBySuit[ suit ];
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
	activeRound: Callbreak.RoundWithCards,
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