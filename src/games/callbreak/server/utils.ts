import * as Match from "effect/Match";
import { castDraft, produce } from "immer";

import type { CallbreakEvent, CallbreakState } from "@/games/callbreak/shared/schema.ts";
import { getCardSuit } from "@/shared/cards/utils.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";

// --- Pure reducer ----------------------------------------------------------
// The `apply(state, event)` fold — the ONLY place `state` changes. Mutations are
// on an immer draft; the active deal/trick are always `deals[0]`/`tricks[0]`.

/** Pure reducer — the ONLY place `state` changes. Mutations are on an immer draft. */
export const apply = ( state: CallbreakState, event: CallbreakEvent ) =>
	produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "callbreak/ScoreInitialized", ( e ) => { draft.scores[ e.playerId ] = 0; } ),

			Match.tag( "callbreak/DealDealt", ( e ) => { draft.deals.unshift( castDraft( e.deal ) ); } ),

			Match.tag( "callbreak/WinsDeclared", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( deal ) {
					deal.declarations[ e.playerId ] = e.wins;
				}
			} ),

			Match.tag( "callbreak/TrickStarted", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( deal ) {
					deal.tricks.unshift( castDraft( { leadPlayer: e.leadPlayer, cards: {} } ) );
				}
			} ),

			Match.tag( "callbreak/CardPlayed", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( !deal ) {
					return;
				}
				deal.hands[ e.playerId ] =
					( deal.hands[ e.playerId ] ?? [] ).filter( ( c ) => c !== e.cardId );
				const trick = deal.tricks[ 0 ];
				if ( !trick ) {
					return;
				}
				trick.cards[ e.playerId ] = e.cardId;
				trick.suit = trick.suit ?? getCardSuit( e.cardId );
			} ),

			Match.tag( "callbreak/TrickWon", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( !deal ) {
					return;
				}
				const trick = deal.tricks[ 0 ];
				if ( trick ) {
					trick.winner = e.winner;
				}
				deal.wins[ e.winner ] = ( deal.wins[ e.winner ] ?? 0 ) + 1;
			} ),

			Match.tag( "callbreak/DealScored", ( e ) => {
				const deal = draft.deals[ 0 ];
				if ( deal ) {
					Object.assign( deal.scores, e.scores );
				}
				for ( const pid of Object.keys( e.scores ) as PlayerId[] ) {
					draft.scores[ pid ] = ( draft.scores[ pid ] ?? 0 ) + ( e.scores[ pid ] ?? 0 );
				}
			} ),

			Match.tag( "callbreak/WinnerDecided", ( e ) => { draft.winner = e.winner; } ),

			Match.exhaustive
		);
	} );
