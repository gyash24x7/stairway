import * as Match from "effect/Match";
import { castDraft, produce } from "immer";

import type { KingdominoEvent, KingdominoState } from "@/games/kingdomino/shared/schema.ts";

// --- Pure reducer ----------------------------------------------------------

/** Pure reducer — the ONLY place `state` changes. Mutations are on an immer draft. */
export const apply = (
	state: KingdominoState,
	event: KingdominoEvent
): KingdominoState =>
	produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "kingdomino/DeckShuffled", ( e ) => { draft.deck = castDraft( e.deck ); } ),
			Match.tag( "kingdomino/PlayerBoardCreated", ( e ) => {
				draft.playerData[ e.playerId ] = castDraft( {
					board: e.board,
					queue: [],
					score: { regions: [], points: 0 }
				} );
			} ),
			Match.tag( "kingdomino/SelectionOrderSet", ( e ) => { draft.selectionOrder = castDraft( e.order ); } ),
			Match.tag( "kingdomino/DraftDrawn", ( e ) => {
				draft.draft = castDraft( e.draft );
				draft.deck = castDraft( e.deck );
			} ),
			Match.tag( "kingdomino/DraftPruned", () => {
				draft.draft = draft.draft.filter( ( entry ) => !!entry.selectedBy );
			} ),
			Match.tag( "kingdomino/DominoSelected", ( e ) => {
				const entry = draft.draft.find( ( x ) => x.domino.id === e.dominoId );
				if ( entry ) {
					entry.selectedBy = e.playerId;
				}
				draft.playerData[ e.playerId ]!.queue.push( e.dominoId );
			} ),
			Match.tag( "kingdomino/DominoPlaced", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				player.board = castDraft( e.board );
				player.score = castDraft( e.score );
				player.queue = player.queue.filter( ( id ) => id !== e.dominoId );
			} ),
			Match.tag( "kingdomino/DominoDiscarded", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				player.queue = player.queue.filter( ( id ) => id !== e.dominoId );
			} ),
			Match.tag(
				"kingdomino/SelectionOrderRecomputed",
				( e ) => { draft.selectionOrder = castDraft( e.order ); }
			),
			Match.tag( "kingdomino/WinnerDecided", ( e ) => { draft.winner = e.winner; } ),
			Match.exhaustive
		);
	} );
