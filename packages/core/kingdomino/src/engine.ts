// @s2h/kingdomino/engine — Kingdomino as an event-sourced swish game.
//
// Server-only. The swish port of the old `AbstractGameEngine` DO. Same rules,
// re-expressed under event sourcing: the deciders (`onJoin`, `onStart`, phase
// `onEnter`/`onExit`, hooks, `execute`) EMIT domain events and a pure `apply`
// reducer (in ./utils) folds them onto `state` (the ONLY place state changes).
//
// PHASED game: SELECT (draft dominoes) and PLACE (place / discard) phases.
//
// Nondeterminism (deck shuffle, per-round draft draw, shuffled first selection
// order) lives in the deciders and is CAPTURED in the emitted events' payloads —
// the drawn dominoes / shuffled orders travel in the event so replay is exact.
// `apply` never calls `Math.random`.

import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { type PlayerId } from "@s2h/swish/schema";
import { definePhasedGame } from "@s2h/swish/structure";
import { shuffle } from "@s2h/utils/array";
import * as Effect from "effect/Effect";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import {
	DeckShuffled,
	DiscardDominoInput,
	type Domino,
	DominoDiscarded,
	DominoPlaced,
	DominoSelected,
	DraftDrawn,
	DraftPruned,
	KingdominoConfig,
	KingdominoEvent,
	KingdominoPlayerView,
	KingdominoSharedView,
	KingdominoSnapshot,
	KingdominoState,
	PlaceDominoInput,
	PlayerBoardCreated,
	SelectDominoInput,
	SelectionOrderRecomputed,
	SelectionOrderSet,
	WinnerDecided
} from "./schema";
import {
	applyPlacement,
	apply,
	asBoard,
	asBoardResult,
	asPlacement,
	asScoreResult,
	calculateScore,
	calculateShift,
	canDominoBePlaced,
	CASTLES,
	createBoard,
	DOMINO_DECK,
	draftPlayerOrder,
	drawDraftPure,
	getPlacementCoordinates,
	getPlayerSelectionCount,
	getSelectionsPerPlayer,
	getShiftedTiles,
	getValidPlacements
} from "./utils";

// --- Engine ----------------------------------------------------------------

export const kingdomino = makeEngine(
	definePhasedGame( {
		name: "kingdomino",
		stateSchema: KingdominoState,
		configSchema: KingdominoConfig,
		sharedViewSchema: KingdominoSharedView,
		playerViewSchema: KingdominoPlayerView,
		eventSchema: KingdominoEvent,
		apply,

		// setup: initial state has an EMPTY deck; the shuffle is emitted as an
		// event of `onStart`. We shuffle there (nondeterministic) but capture it
		// via `DeckShuffled` so the log holds the exact deck.
		setup: () => Effect.succeed( {
			playerData: {},
			deck: [],
			draft: [],
			selectionOrder: []
		} ),

		endIf: ( { state, context } ) => {
			const allQueuesEmpty = context.players.every( ( pid ) =>
				( state.playerData[ pid ]?.queue.length ?? 0 ) === 0 );
			const allDraftResolved = state.draft.every( ( entry ) => !!entry.selectedBy );
			return Effect.succeed( allQueuesEmpty && state.deck.length === 0 && allDraftResolved );
		},

		sharedView: ( { state } ) => {
			const { deck: _deck, ...rest } = state;
			return Effect.succeed( rest );
		},
		playerView: ( _data, playerId ) => Effect.succeed( { playerId } ),

		hooks: {
			// Seed each joiner's board (castle by join index). Config supplies boardSize.
			onJoin: ( { state, config }, playerId ) => {
				const castleIndex = Object.keys( state.playerData ).length;
				const board = createBoard( CASTLES[ castleIndex ]!, config.boardSize );
				return Effect.succeed( [
					PlayerBoardCreated.make( { playerId, board: asBoardResult( board ) } )
				] );
			},

			// At start: shuffle the deck (captured) and shuffle the first-round
			// selection order (captured). Deterministic replay via the events.
			onStart: ( { context } ) => {
				const deck = shuffle( [ ...DOMINO_DECK ] );
				const selections = getSelectionsPerPlayer( context.players.length );
				const slots = context.players.flatMap( ( pid ) => Array( selections ).fill( pid ) );
				const order = shuffle( slots ) as ReadonlyArray<PlayerId>;
				return Effect.succeed( [
					DeckShuffled.make( { deck: deck as ReadonlyArray<typeof Domino.Type> } ),
					SelectionOrderSet.make( { order } )
				] );
			},

			onEnd: ( { state, context } ) => {
				const players = context.players;
				const winner = players.reduce( ( best, pid ) =>
					( state.playerData[ pid ]?.score.points ?? 0 ) > ( state.playerData[ best ]?.score.points ?? 0 )
						? pid
						: best );
				return Effect.succeed( [ WinnerDecided.make( { winner } ) ] );
			}
		},

		initialPhase: "SELECT",

		phases: {
			SELECT: {
				// Draw the next draft from the (already-shuffled) deck. The drawn
				// entries + remaining deck are captured so replay is exact.
				onEnter: ( { state } ) => {
					if ( state.deck.length === 0 ) {
						return Effect.succeed( [] );
					}
					const { draft, deck } = drawDraftPure( state.deck );
					return Effect.succeed( [ DraftDrawn.make( { draft, deck } ) ] );
				},

				// Drop the unselected draft entries.
				onExit: () => Effect.succeed( [ DraftPruned.make( {} ) ] ),

				resolveStartingPlayer: ( { state, context } ) =>
					Effect.succeed(
						state.selectionOrder.length > 0
							? state.selectionOrder[ 0 ]!
							: context.players[ 0 ]!
					),

				moves: {
					selectDomino: {
						input: SelectDominoInput,
						validate: ( { state, context: { players } }, playerId, { dominoId } ) => {
							const entry = state.draft.find( ( e ) => e.domino.id === dominoId );
							if ( !entry ) {
								return Effect.fail(
									new InvalidMove( { move: "selectDomino", reason: "Domino not in draft!" } ) );
							}
							if ( entry.selectedBy ) {
								return Effect.fail(
									new InvalidMove( { move: "selectDomino", reason: "Domino already selected!" } ) );
							}
							const selectionsPerPlayer = getSelectionsPerPlayer( players.length );
							const playerSelections = getPlayerSelectionCount( [ ...state.draft ] as never, playerId );
							if ( playerSelections >= selectionsPerPlayer ) {
								return Effect.fail( new InvalidMove( {
									move: "selectDomino",
									reason: "Already selected maximum dominos this round!"
								} ) );
							}
							return Effect.void;
						},
						execute: ( _data, playerId, { dominoId } ) =>
							Effect.succeed( [ DominoSelected.make( { dominoId, playerId } ) ] )
					}
				},

				resolveNextPlayer: ( { state } ) => {
					const consumed = state.draft.filter( ( e ) => !!e.selectedBy ).length;
					return Effect.succeed( state.selectionOrder[ consumed ] ?? state.selectionOrder[ 0 ]! );
				},

				endIf: ( { state } ) =>
					Effect.succeed(
						state.draft.filter( ( e ) => !!e.selectedBy ).length >= state.selectionOrder.length
					),

				resolveNextPhase: () => Effect.succeed( "PLACE" )
			},

			PLACE: {
				resolveStartingPlayer: ( { state } ) => {
					const draftOrder = draftPlayerOrder( state.draft );
					return Effect.succeed( draftOrder[ 0 ]! );
				},

				moves: {
					placeDomino: {
						input: PlaceDominoInput,
						canMove: ( { state }, playerId ) =>
							Effect.succeed( ( state.playerData[ playerId ]?.queue.length ?? 0 ) > 0 ),
						validate: ( { state }, playerId, { placement } ) => {
							const player = state.playerData[ playerId ]!;
							if ( !player.queue.includes( placement.dominoId ) ) {
								return Effect.fail(
									new InvalidMove( { move: "placeDomino", reason: "Domino not in your queue!" } ) );
							}
							const lowest = Math.min( ...player.queue );
							if ( placement.dominoId !== lowest ) {
								return Effect.fail(
									new InvalidMove( { move: "placeDomino", reason: "Place lower-id domino first!" } ) );
							}
							if ( !canDominoBePlaced( asBoard( player.board ), asPlacement( placement ) ) ) {
								return Effect.fail(
									new InvalidMove( { move: "placeDomino", reason: "Invalid placement!" } ) );
							}
							return Effect.void;
						},
						execute: ( { state }, playerId, { placement: input } ) => {
							const player = state.playerData[ playerId ]!;
							let board = asBoard( player.board );
							let placement = asPlacement( input );

							const coords = getPlacementCoordinates( placement );
							const shift = calculateShift( coords, board.size );
							if ( shift.x !== 0 || shift.y !== 0 ) {
								const shiftedTiles = getShiftedTiles( board, shift );
								if ( shiftedTiles ) {
									board = { ...board, tiles: shiftedTiles };
									placement = {
										...placement,
										coord: {
											x: placement.coord.x + shift.x,
											y: placement.coord.y + shift.y
										}
									};
								}
							}

							const nextBoard = applyPlacement( board, placement );
							const score = calculateScore( nextBoard );
							return Effect.succeed( [ DominoPlaced.make( {
								playerId,
								dominoId: input.dominoId,
								board: asBoardResult( nextBoard ),
								score: asScoreResult( score )
							} ) ] );
						}
					},

					discardDomino: {
						input: DiscardDominoInput,
						canMove: ( { state }, playerId ) =>
							Effect.succeed( ( state.playerData[ playerId ]?.queue.length ?? 0 ) > 0 ),
						validate: ( { state }, playerId, { dominoId } ) => {
							const player = state.playerData[ playerId ]!;
							if ( !player.queue.includes( dominoId ) ) {
								return Effect.fail(
									new InvalidMove( { move: "discardDomino", reason: "Domino not in your queue!" } ) );
							}
							const lowest = Math.min( ...player.queue );
							if ( dominoId !== lowest ) {
								return Effect.fail( new InvalidMove( {
									move: "discardDomino",
									reason: "Discard lower-id domino first!"
								} ) );
							}
							const validPlacements = getValidPlacements( asBoard( player.board ), dominoId );
							if ( validPlacements.length > 0 ) {
								return Effect.fail(
									new InvalidMove( { move: "discardDomino", reason: "Domino can still be placed!" } ) );
							}
							return Effect.void;
						},
						execute: ( _data, playerId, { dominoId } ) =>
							Effect.succeed( [ DominoDiscarded.make( { playerId, dominoId } ) ] )
					}
				},

				resolveNextPlayer: ( { state } ) => {
					const draftOrder = draftPlayerOrder( state.draft );
					const nextPlacer = draftOrder.find( ( pid ) =>
						( state.playerData[ pid ]?.queue.length ?? 0 ) > 0 );
					return Effect.succeed( nextPlacer ?? draftOrder[ 0 ]! );
				},

				endIf: ( { state, context } ) =>
					Effect.succeed( context.players.every(
						( pid ) => ( state.playerData[ pid ]?.queue.length ?? 0 ) === 0
					) ),

				// Recompute next-round selection order from the resolved draft.
				onExit: ( { state } ) => {
					const order = draftPlayerOrder( state.draft );
					return Effect.succeed( [ SelectionOrderRecomputed.make( { order } ) ] );
				},

				resolveNextPhase: () => Effect.succeed( "SELECT" )
			}
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class KingdominoRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( KingdominoConfig ),
	EngineRpc.makeGetState( KingdominoSnapshot ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "selectDomino", SelectDominoInput ),
	EngineRpc.makeForMove( "placeDomino", PlaceDominoInput ),
	EngineRpc.makeForMove( "discardDomino", DiscardDominoInput ),
	EngineRpc.makeUndo( KingdominoSnapshot ),
	EngineRpc.makeRedo( KingdominoSnapshot )
) {
	public static layer = KingdominoRpcs.toLayer( {
		initialize: kingdomino.initialize,
		getState: kingdomino.getState,
		join: kingdomino.join,
		addBots: kingdomino.addBots,
		start: kingdomino.start,
		undo: kingdomino.undo,
		redo: kingdomino.redo,
		selectDomino: ( { playerInfo, input } ) =>
			kingdomino.submitMove( "selectDomino", playerInfo, input ),
		placeDomino: ( { playerInfo, input } ) =>
			kingdomino.submitMove( "placeDomino", playerInfo, input ),
		discardDomino: ( { playerInfo, input } ) =>
			kingdomino.submitMove( "discardDomino", playerInfo, input )
	} );
}
