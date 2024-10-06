import { Injectable } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import {
	CARD_SUITS,
	CardDeck,
	CardHand,
	CardRank,
	CardSuit,
	getBestCardPlayed,
	getPlayableCards,
	PlayingCard
} from "@stairway/cards";
import type { DealWithRounds } from "./callbreak.types.ts";

const BIG_RANKS = [ CardRank.ACE, CardRank.KING, CardRank.QUEEN ];

@Injectable()
export class CallBreakBotService {

	constructor( @OgmaLogger( CallBreakBotService ) private readonly logger: OgmaService ) {}

	suggestDealWins( hand: CardHand, trumpSuit: CardSuit ) {
		this.logger.debug( ">> suggestDealWins()" );

		const cardsBySuit = hand.groupedBySuit();
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

		this.logger.debug( "<< suggestDealWins()" );
		return possibleWins;
	}

	suggestCardToPlay( hand: CardHand, deal: DealWithRounds, trumpSuit: CardSuit ) {
		this.logger.debug( ">> suggestCardToPlay()" );

		const activeRound = deal.rounds[ 0 ];
		const cardsAlreadyPlayed = deal.rounds.flatMap( round => Object.values( round.cards ) ).map( PlayingCard.fromId );
		const cardsPlayedInActiveRound = Object.values( activeRound.cards ).map( PlayingCard.fromId );
		const bestCardInActiveRound = getBestCardPlayed( cardsPlayedInActiveRound, trumpSuit, activeRound.suit );
		const playableCards = getPlayableCards( hand, trumpSuit, bestCardInActiveRound, activeRound.suit )
			.map( PlayingCard.fromId );

		const deck = new CardDeck();
		const unbeatableCards = playableCards.filter( card => {
			const greaterCards = deck.cards.filter( deckCard => deckCard.isGreaterThan( card.id ) );
			return greaterCards.every( greaterCard => cardsAlreadyPlayed.includes( greaterCard ) );
		} );

		const cardToPlay = unbeatableCards.length > 0
			? unbeatableCards[ Math.floor( Math.random() * unbeatableCards.length ) ]
			: playableCards[ Math.floor( Math.random() * playableCards.length ) ];

		this.logger.debug( "<< suggestCardToPlay()" );
		return cardToPlay;
	}
}