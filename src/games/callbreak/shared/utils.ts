import type { Trick } from "@/games/callbreak/shared/schema.ts";
import { Deal } from "@/games/callbreak/shared/schema.ts";
import type { CardId, CardRank, CardSuit } from "@/shared/cards/schema.ts";
import { generateDeck, generateHands, getCardRank, getCardSuit } from "@/shared/cards/utils.ts";
import { PlayerId } from "@/shared/swish/schema.ts";
import { generateId } from "@/shared/utils/generator.ts";


export const PLAYER_COUNT = 4;
export const TRICKS_PER_DEAL = 13;
export const RANK_ORDER: CardRank[] = [
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
	"A"
];

function getRankValue( rank: CardRank ) {
	return RANK_ORDER.indexOf( rank );
}

export function getCardValue( card: CardId ) {
	return getRankValue( getCardRank( card ) );
}

export function determineTrickWinner( trick: Trick, trump: CardSuit, players: PlayerId[] ) {
	const leadCard = trick.cards[ trick.leadPlayer ]!;

	let winningPlayer = trick.leadPlayer;
	let winningCard = leadCard;

	for ( const playerId of players ) {
		if ( playerId === trick.leadPlayer ) {
			continue;
		}
		const card = trick.cards[ playerId ];
		if ( !card ) {
			continue;
		}

		const cardSuit = getCardSuit( card );
		const winningSuit = getCardSuit( winningCard );

		if ( cardSuit === trump && winningSuit !== trump ) {
			winningPlayer = playerId;
			winningCard = card;
		} else if ( cardSuit === winningSuit && getCardValue( card ) > getCardValue( winningCard ) ) {
			winningPlayer = playerId;
			winningCard = card;
		}
	}

	return winningPlayer;
}

export function createNewDeal( players: PlayerId[], startingPlayer?: PlayerId ): Deal {
	const deck = generateDeck();
	const generatedHands = generateHands( deck, PLAYER_COUNT );
	return Deal.make( {
		id: generateId(),
		startingPlayer: startingPlayer ?? players[ 0 ]!,
		tricks: [],
		...players.reduce(
			( acc, pid, idx ) => {
				acc.hands[ pid ] = generatedHands[ idx ]!;
				acc.declarations[ pid ] = 0;
				acc.wins[ pid ] = 0;
				acc.scores[ pid ] = 0;
				return acc;
			},
			{
				declarations: {} as Record<PlayerId, number>,
				wins: {} as Record<PlayerId, number>,
				scores: {} as Record<PlayerId, number>,
				hands: {} as Record<PlayerId, CardId[]>
			}
		)
	} );
}

export function emptyTrick( leadPlayer: PlayerId = PlayerId.make( "" ) ): Trick {
	return { leadPlayer, cards: {} };
}

function getHighestCardValue( cards: CardId[], suit: string ): number {
	return cards
		.filter( c => getCardSuit( c ) === suit )
		.reduce( ( max, c ) => Math.max( max, getCardValue( c ) ), -1 );
}

export function getPlayableCards( hand: CardId[], trump: CardSuit, trick: Trick ): CardId[] {
	const trickCards = Object.values( trick.cards );

	// Leading the trick — any card
	if ( trickCards.length === 0 ) {
		return hand;
	}

	const leadSuit = trick.suit!;
	const suitCards = hand.filter( c => getCardSuit( c ) === leadSuit );

	if ( suitCards.length > 0 ) {
		const trumpPlayed = trickCards.some( c => getCardSuit( c ) === trump );

		// If trump has been played, any suit card is fine (can't beat trump with suit)
		if ( trumpPlayed && leadSuit !== trump ) {
			return suitCards;
		}

		// Must play higher than current highest of that suit if possible
		const highestPlayed = getHighestCardValue( trickCards, leadSuit );
		const higherCards = suitCards.filter( c => getCardValue( c ) > highestPlayed );
		return higherCards.length > 0 ? higherCards : suitCards;
	}

	// Can't follow suit — must trump
	const trumpCards = hand.filter( c => getCardSuit( c ) === trump );

	if ( trumpCards.length > 0 ) {
		// If trump already played, must play higher trump if possible
		const highestTrumpPlayed = getHighestCardValue( trickCards, trump );
		if ( highestTrumpPlayed >= 0 ) {
			const higherTrumps = trumpCards.filter( c => getCardValue( c ) > highestTrumpPlayed );
			return higherTrumps.length > 0 ? higherTrumps : hand;
		}
		return trumpCards;
	}

	// No suit cards, no trump — any card
	return hand;
}

export function calculateRoundScore( call: number, won: number ): number {
	if ( won >= call ) {
		return call * 10 + ( won - call ) * 2;
	}
	return -call * 10;
}