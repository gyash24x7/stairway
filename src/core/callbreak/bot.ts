import type { Round } from "@/core/callbreak/schema";
import { getBestCardPlayed, getPlayableCards } from "@/core/callbreak/utils";
import { CARD_RANKS, CARD_SUITS } from "@/core/cards/constants";
import type { CardRank, CardSuit, PlayingCard } from "@/core/cards/types";
import { compareCards, generateDeck, getCardFromId, getCardsOfSuit } from "@/core/cards/utils";
import { createLogger } from "@/utils/logger";

const logger = createLogger( "Callbreak:Bot" );

/**
 * Suggests the number of wins a player can declare based on their hand and the trump suit.
 * This method analyzes the player's hand, counts the possible winning cards,
 * and returns a suggested number of wins.
 *
 * @param {PlayingCard[]} hand - The player's hand of cards.
 * @param {CardSuit} trumpSuit - The current trump suit in the game.
 * @returns {number} The suggested number of wins for the player.
 */
function suggestDealWins( hand: PlayingCard[], trumpSuit: CardSuit ): number {
	logger.debug( ">> suggestDealWins()" );

	let possibleWins = 0;
	const BIG_RANKS = [ CARD_RANKS.ACE, CARD_RANKS.KING, CARD_RANKS.QUEEN ] as CardRank[];
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

/**
 * Suggests a card to play based on the player's hand, the active round, and the cards already played.
 * This method analyzes the playable cards in the hand, checks for unbeatable cards,
 * and returns a suggested card to play.
 *
 * @param {PlayingCard[]} hand - The player's hand of cards.
 * @param {Round} activeRound - The current active round in the game.
 * @param {PlayingCard[]} cardsAlreadyPlayed - The cards that have already been played in the current round.
 * @param {CardSuit} trumpSuit - The current trump suit in the game.
 * @returns {PlayingCard} The suggested card to play.
 */
function suggestCardToPlay(
	hand: PlayingCard[],
	activeRound: Round,
	cardsAlreadyPlayed: PlayingCard[],
	trumpSuit: CardSuit
): PlayingCard {
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

export const botEngine = { suggestCardToPlay, suggestDealWins };