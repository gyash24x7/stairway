import type { CallbreakEvent, CallbreakState, Trick } from "@s2h/schema/callbreak";
import { Deal } from "@s2h/schema/callbreak";
import { getCardSuit } from "@s2h/utils/cards";
import * as Match from "effect/Match";

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
