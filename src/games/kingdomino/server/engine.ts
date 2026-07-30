import {
	DeckShuffled,
	DiscardDominoInput,
	DominoDiscarded,
	DominoPlaced,
	DominoSelected,
	DraftDrawn,
	DraftPruned,
	KingdominoConfig,
	KingdominoEvent,
	KingdominoPlayerView,
	KingdominoState,
	KingdominoTableView,
	KingdominoView,
	PlaceDominoInput,
	PlayerBoardCreated,
	SelectDominoInput,
	SelectionOrderRecomputed,
	SelectionOrderSet,
	WinnerDecided
} from "@/games/kingdomino/shared/schema.ts";
import {
	applyPlacement,
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
} from "@/games/kingdomino/shared/utils.ts";
import { makeEngine } from "@/shared/swish/engine.ts";
import { InvalidMove } from "@/shared/swish/errors.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";
import type { ReadonlyGameData } from "@/shared/swish/structure.ts";
import { defineView } from "@/shared/swish/views.ts";
import { shuffle } from "@/shared/utils/array.ts";
import { apply } from "@/games/kingdomino/server/utils.ts";

/** The public board both audiences see: the full state minus the hidden `deck`. */
const publicBoard = ( { state }: ReadonlyGameData<KingdominoState, KingdominoConfig> ) => {
	const { deck: _deck, ...rest } = state;
	return rest;
};

// --- Engine ----------------------------------------------------------------

export const kingdomino = makeEngine( {
	name: "kingdomino",
	schemas: {
		state: KingdominoState,
		config: KingdominoConfig,
		events: KingdominoEvent,
		view: KingdominoView,
		moves: {
			selectDomino: SelectDominoInput,
			placeDomino: PlaceDominoInput,
			discardDomino: DiscardDominoInput
		}
	},

	// setup: initial state has an EMPTY deck; the shuffle is emitted as an
	// event of `onStart`. We shuffle there (nondeterministic) but capture it
	// via `DeckShuffled` so the log holds the exact deck.
	setup: () => ( {
		playerData: {},
		deck: [],
		draft: [],
		selectionOrder: []
	} ),

	apply,

	endIf: ( { state, context } ) => {
		const allQueuesEmpty = context.players.every( ( pid ) =>
			( state.playerData[ pid ]?.queue.length ?? 0 ) === 0 );
		const allDraftResolved = state.draft.every( ( entry ) => !!entry.selectedBy );
		return allQueuesEmpty && state.deck.length === 0 && allDraftResolved;
	},

	view: defineView( {
		table: ( data ) => KingdominoTableView.make( publicBoard( data ) ),
		player: ( data, id ) => KingdominoPlayerView.make( { ...publicBoard( data ), playerId: id } )
	} ),

	hooks: {
		// Seed each joiner's board (castle by join index). Config supplies boardSize.
		onJoin: ( { state, config }, playerId ) => {
			const castleIndex = Object.keys( state.playerData ).length;
			const board = createBoard( CASTLES[ castleIndex ]!, config.boardSize );
			return [ PlayerBoardCreated.make( { playerId, board } ) ];
		},

		// At start: shuffle the deck (captured) and shuffle the first-round
		// selection order (captured). Deterministic replay via the events.
		onStart: ( { context } ) => {
			const deck = shuffle( [ ...DOMINO_DECK ] );
			const selections = getSelectionsPerPlayer( context.players.length );
			const slots = context.players.flatMap( ( pid ) => Array( selections ).fill( pid ) );
			const order = shuffle( slots ) as ReadonlyArray<PlayerId>;
			return [
				DeckShuffled.make( { deck } ),
				SelectionOrderSet.make( { order } )
			];
		},

		onEnd: ( { state, context } ) => {
			const players = context.players;
			const winner = players.reduce( ( best, pid ) =>
				( state.playerData[ pid ]?.score.points ?? 0 ) >
				( state.playerData[ best ]?.score.points ?? 0 )
					? pid
					: best );
			return [ WinnerDecided.make( { winner } ) ];
		}
	},

	moves: {
		selectDomino: {
			phase: "SELECT",

			validate: ( { state, context: { players } }, playerId, { dominoId } ) => {
				const entry = state.draft.find( ( e ) => e.domino.id === dominoId );
				if ( !entry ) {
					return new InvalidMove( { move: "selectDomino", reason: "Domino not in draft!" } );
				}

				if ( entry.selectedBy ) {
					return new InvalidMove( { move: "selectDomino", reason: "Domino already selected!" } );
				}

				const selectionsPerPlayer = getSelectionsPerPlayer( players.length );
				const playerSelections = getPlayerSelectionCount( [ ...state.draft ] as never, playerId );

				if ( playerSelections >= selectionsPerPlayer ) {
					return new InvalidMove( {
						move: "selectDomino",
						reason: "Already selected maximum dominos this round!"
					} );
				}

				return undefined;
			},

			execute: ( _data, playerId, { dominoId } ) => [
				DominoSelected.make( { dominoId, playerId } )
			]
		},

		placeDomino: {
			phase: "PLACE",

			canMove: ( { state }, playerId ) => ( state.playerData[ playerId ]?.queue.length ?? 0 ) > 0,

			validate: ( { state }, playerId, { placement } ) => {
				const player = state.playerData[ playerId ]!;
				if ( !player.queue.includes( placement.dominoId ) ) {
					return new InvalidMove( {
						move: "placeDomino",
						reason: "Domino not in your queue!"
					} );
				}

				const lowest = Math.min( ...player.queue );
				if ( placement.dominoId !== lowest ) {
					return new InvalidMove( {
						move: "placeDomino",
						reason: "Place lower-id domino first!"
					} );
				}

				if ( !canDominoBePlaced( player.board, placement ) ) {
					return new InvalidMove( { move: "placeDomino", reason: "Invalid placement!" } );
				}

				return undefined;
			},

			execute: ( { state }, playerId, { placement } ) => {
				const player = state.playerData[ playerId ]!;
				let board = player.board;

				const coords = getPlacementCoordinates( placement );
				const shift = calculateShift( coords, player.board.size );

				if ( shift.x !== 0 || shift.y !== 0 ) {
					const shiftedTiles = getShiftedTiles( player.board, shift );
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

				board = applyPlacement( board, placement );
				const score = calculateScore( board );

				return [ DominoPlaced.make( { playerId, dominoId: placement.dominoId, board, score } ) ];
			}
		},

		discardDomino: {
			phase: "PLACE",

			canMove: ( { state }, playerId ) => ( state.playerData[ playerId ]?.queue.length ?? 0 ) > 0,

			validate: ( { state }, playerId, { dominoId } ) => {
				const player = state.playerData[ playerId ]!;
				if ( !player.queue.includes( dominoId ) ) {
					return new InvalidMove( {
						move: "discardDomino",
						reason: "Domino not in your queue!"
					} );
				}

				const lowest = Math.min( ...player.queue );
				if ( dominoId !== lowest ) {
					return new InvalidMove( {
						move: "discardDomino",
						reason: "Discard lower-id domino first!"
					} );
				}

				const validPlacements = getValidPlacements( player.board, dominoId );
				if ( validPlacements.length > 0 ) {
					return new InvalidMove( {
						move: "discardDomino",
						reason: "Domino can still be placed!"
					} );
				}

				return undefined;
			},

			execute: ( _data, playerId, { dominoId } ) => [
				DominoDiscarded.make( { playerId, dominoId } )
			]
		}
	},

	initialPhase: "SELECT",

	phases: {
		SELECT: {
			moves: [ "selectDomino" ],

			// Draw the next draft from the (already-shuffled) deck. The drawn
			// entries + remaining deck are captured so replay is exact.
			onEnter: ( { state } ) => {
				if ( state.deck.length === 0 ) {
					return [];
				}

				const { draft, deck } = drawDraftPure( state.deck );
				return [ DraftDrawn.make( { draft, deck } ) ];
			},

			// Drop the unselected draft entries.
			onExit: () => [ DraftPruned.make( {} ) ],

			resolveStartingPlayer: ( { state, context } ) =>
				state.selectionOrder.length > 0
					? state.selectionOrder[ 0 ]!
					: context.players[ 0 ]!,

			resolveNextPlayer: ( { state } ) => {
				const consumed = state.draft.filter( ( e ) => !!e.selectedBy ).length;
				return state.selectionOrder[ consumed ] ?? state.selectionOrder[ 0 ]!;
			},

			endIf: ( { state: { draft, selectionOrder } } ) =>
				draft.filter( e => !!e.selectedBy ).length >= selectionOrder.length,

			resolveNextPhase: () => "PLACE"
		},

		PLACE: {
			moves: [ "placeDomino", "discardDomino" ],

			resolveStartingPlayer: ( { state } ) => {
				const draftOrder = draftPlayerOrder( state.draft );
				return draftOrder[ 0 ]!;
			},

			resolveNextPlayer: ( { state } ) => {
				const draftOrder = draftPlayerOrder( state.draft );
				const nextPlacer = draftOrder.find( ( pid ) =>
					( state.playerData[ pid ]?.queue.length ?? 0 ) > 0 );
				return nextPlacer ?? draftOrder[ 0 ]!;
			},

			endIf: ( { state, context } ) => context.players.every(
				pid => ( state.playerData[ pid ]?.queue.length ?? 0 ) === 0
			),

			// Recompute next-round selection order from the resolved draft.
			onExit: ( { state } ) => {
				const order = draftPlayerOrder( state.draft );
				return [ SelectionOrderRecomputed.make( { order } ) ];
			},

			resolveNextPhase: () => "SELECT"
		}
	}
} );
