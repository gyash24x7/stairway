import type { KingdominoEvent, KingdominoState } from "@s2h/schema/kingdomino";
import * as Match from "effect/Match";

// --- Pure reducer ----------------------------------------------------------

/** Pure reducer — the ONLY place `state` changes. No Effect, no Random. */
export const apply = (
	state: KingdominoState,
	event: KingdominoEvent
): KingdominoState =>
	Match.value( event ).pipe(
		Match.tag( "kingdomino/DeckShuffled", ( e ) => ( { ...state, deck: e.deck } ) ),
		Match.tag( "kingdomino/PlayerBoardCreated", ( e ) => ( {
			...state,
			playerData: {
				...state.playerData,
				[ e.playerId ]: { board: e.board, queue: [], score: { regions: [], points: 0 } }
			}
		} ) ),
		Match.tag( "kingdomino/SelectionOrderSet", ( e ) => ( { ...state, selectionOrder: e.order } ) ),
		Match.tag( "kingdomino/DraftDrawn", ( e ) => ( { ...state, draft: e.draft, deck: e.deck } ) ),
		Match.tag( "kingdomino/DraftPruned", () => ( {
			...state,
			draft: state.draft.filter( ( entry ) => !!entry.selectedBy )
		} ) ),
		Match.tag( "kingdomino/DominoSelected", ( e ) => {
			const draft = state.draft.map( ( entry ) =>
				entry.domino.id === e.dominoId ? { ...entry, selectedBy: e.playerId } : entry );
			const player = state.playerData[ e.playerId ]!;
			return {
				...state,
				draft,
				playerData: {
					...state.playerData,
					[ e.playerId ]: { ...player, queue: [ ...player.queue, e.dominoId ] }
				}
			};
		} ),
		Match.tag( "kingdomino/DominoPlaced", ( e ) => {
			const player = state.playerData[ e.playerId ]!;
			return {
				...state,
				playerData: {
					...state.playerData,
					[ e.playerId ]: {
						...player,
						board: e.board,
						score: e.score,
						queue: player.queue.filter( ( id ) => id !== e.dominoId )
					}
				}
			};
		} ),
		Match.tag( "kingdomino/DominoDiscarded", ( e ) => {
			const player = state.playerData[ e.playerId ]!;
			return {
				...state,
				playerData: {
					...state.playerData,
					[ e.playerId ]: { ...player, queue: player.queue.filter( ( id ) => id !== e.dominoId ) }
				}
			};
		} ),
		Match.tag(
			"kingdomino/SelectionOrderRecomputed",
			( e ) => ( { ...state, selectionOrder: e.order } )
		),
		Match.tag( "kingdomino/WinnerDecided", ( e ) => ( { ...state, winner: e.winner } ) ),
		Match.exhaustive
	);
