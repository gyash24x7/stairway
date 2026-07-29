import type { CallbreakEvent, CallbreakState, Trick } from "@s2h/schema/callbreak";
import { Deal } from "@s2h/schema/callbreak";
import { PlayerId } from "@s2h/swish/schema";
import {
	type CardId,
	type CardRank,
	type CardSuit,
	generateDeck,
	generateHands,
	getCardRank,
	getCardSuit
} from "@s2h/utils/cards";
import { generateId } from "@s2h/utils/generator";
import * as Match from "effect/Match";

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

// --- Pure reducer ----------------------------------------------------------
// The `apply(state, event)` fold — the ONLY place `state` changes. Kept pure
// (effect/Match, sync) so replay is deterministic.

/** Replace deal 0 (the active deal) with a patched copy. Pure. */
const patchActiveDeal = (
	state: CallbreakState,
	patch: ( deal: Deal ) => Deal
): CallbreakState => {
	const [ active, ...rest ] = state.deals;
	if ( !active ) {
		return state;
	}
	return { ...state, deals: [ patch( active ), ...rest ] };
};

/** Replace trick 0 (the active trick) of the active deal with a patched copy. Pure. */
const patchActiveTrick = (
	state: CallbreakState,
	patch: ( trick: Trick ) => Trick
): CallbreakState =>
	patchActiveDeal( state, ( deal ) => {
		const [ active, ...rest ] = deal.tricks;
		if ( !active ) {
			return deal;
		}
		return { ...deal, tricks: [ patch( active ), ...rest ] };
	} );

/** Pure reducer — the ONLY place `state` changes. */
export const apply = ( state: CallbreakState, event: CallbreakEvent ): CallbreakState =>
	Match.value( event ).pipe(
		Match.tag( "callbreak/ScoreInitialized", ( e ) =>
			( { ...state, scores: { ...state.scores, [ e.playerId ]: 0 } } ) ),

		Match.tag(
			"callbreak/DealDealt",
			( e ) => ( { ...state, deals: [ e.deal, ...state.deals ] } )
		),

		Match.tag( "callbreak/WinsDeclared", ( e ) =>
			patchActiveDeal( state, ( deal ) =>
				( { ...deal, declarations: { ...deal.declarations, [ e.playerId ]: e.wins } } ) ) ),

		Match.tag( "callbreak/TrickStarted", ( e ) =>
			patchActiveDeal( state, ( deal ) =>
				( {
					...deal,
					tricks: [ { leadPlayer: e.leadPlayer, cards: {} } as Trick, ...deal.tricks ]
				} ) ) ),

		Match.tag( "callbreak/CardPlayed", ( e ) =>
			patchActiveDeal( state, ( deal ) => {
				const hand = ( deal.hands[ e.playerId ] ?? [] ).filter( ( c ) => c !== e.cardId );
				const hands = { ...deal.hands, [ e.playerId ]: hand };
				const [ active, ...rest ] = deal.tricks;
				if ( !active ) {
					return { ...deal, hands };
				}
				const trick: Trick = {
					...active,
					cards: { ...active.cards, [ e.playerId ]: e.cardId },
					suit: active.suit ?? getCardSuit( e.cardId )
				};
				return { ...deal, hands, tricks: [ trick, ...rest ] };
			} ) ),

		Match.tag( "callbreak/TrickWon", ( e ) => {
			const withWinner = patchActiveTrick( state, ( trick ) => ( { ...trick, winner: e.winner } ) );
			return patchActiveDeal( withWinner, ( deal ) =>
				( { ...deal, wins: { ...deal.wins, [ e.winner ]: ( deal.wins[ e.winner ] ?? 0 ) + 1 } } ) );
		} ),

		Match.tag( "callbreak/DealScored", ( e ) => {
			const withDealScores = patchActiveDeal( state, ( deal ) =>
				( { ...deal, scores: { ...deal.scores, ...e.scores } } ) );
			const scores: Record<string, number> = { ...withDealScores.scores };
			for ( const [ pid, delta ] of Object.entries( e.scores ) ) {
				scores[ pid ] = ( scores[ pid ] ?? 0 ) + delta;
			}
			return { ...withDealScores, scores };
		} ),

		Match.tag( "callbreak/WinnerDecided", ( e ) => ( { ...state, winner: e.winner } ) ),

		Match.exhaustive
	);
