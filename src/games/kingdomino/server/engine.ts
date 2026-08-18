import { decideMove } from "@/games/kingdomino/server/bot.ts";
import {
	apply,
	applyPlacement,
	calculateScore,
	CASTLES,
	draftPlayerOrder,
	drawDraft,
	getPlayerSelectionCount,
	getSelectionsPerPlayer,
	standingsFor
} from "@/games/kingdomino/server/utils.ts";
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
	KingdominoState,
	KingdominoView,
	PlaceDominoInput,
	PlayerBoardCreated,
	SelectDominoInput,
	SelectionOrderRecomputed,
	SelectionOrderSet
} from "@/games/kingdomino/shared/schema.ts";
import {
	calculateShift,
	canDominoBePlaced,
	createBoard,
	DOMINO_DECK,
	getPlacementCoordinates,
	getShiftedTiles,
	getValidPlacements
} from "@/games/kingdomino/shared/utils.ts";
import { shuffle } from "@/shared/utils/array.ts";
import { makeEngine } from "@/swish/server/engine.ts";
import { playerIdFor } from "@/swish/server/utils.ts";
import { InvalidMove } from "@/swish/shared/schema.ts";

import type { PlayerId } from "@/swish/shared/schema.ts";

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

	/**
	 * Nothing is dealt here: `setup` runs at `initialize`, when the table is still
	 * empty. The box is shuffled in `onStart`, once the seats are known and the
	 * opening claim order can be drawn for them.
	 */
	setup: () => KingdominoState.make( {
		playerData: {},
		deck: [],
		draft: [],
		selectionOrder: []
	} ),

	apply,

	/**
	 * Over when the box is spent and nobody is still holding a domino.
	 *
	 * Plainly phrased, because the engine asks this before it enters the next
	 * phase: the deck it reads is the one the round was played from, not one the
	 * coming round's `onEnter` has already turned a row off. The last row is
	 * drawn while there is still a round to play it in, and the game ends once
	 * that round's queues are empty.
	 */
	endIf: ( { state, context } ) => {
		const allQueuesEmpty = context.players.every( ( pid ) =>
			( state.playerData[ pid ]?.queue.length ?? 0 ) === 0 );

		return allQueuesEmpty && state.deck.length === 0;
	},

	/**
	 * Final placement by kingdom points, then the rulebook's tie-breaks — largest
	 * single property, then total crowns (`compareStandings`). A seat still level on
	 * all three shares a rank, and a tie at the top is the rulebook's shared
	 * victory, so `winner` stays unset there.
	 */
	resolveResults: ( { state, context } ) => standingsFor( context.players, state.playerData ),

	/**
	 * One shape for every audience. Kingdoms are built face up and the row on
	 * offer is public, so the only redaction is the deck: its order is the whole
	 * of this game's hidden information and it becomes a count.
	 */
	view: ( { state }, audience ) => KingdominoView.make( {
		...state,
		deckCount: state.deck.length,
		playerId: playerIdFor( audience )
	} ),

	hooks: {
		// Seed each joiner's kingdom, taking the next castle colour. Keyed off how
		// many kingdoms exist rather than the roster, so a replay hands out the
		// same colours in the same order.
		onJoin: ( { state, config }, playerId ) => {
			const castleIndex = Object.keys( state.playerData ).length;
			const board = createBoard( CASTLES[ castleIndex ]!, config.boardSize );
			return [ PlayerBoardCreated.make( { playerId, board } ) ];
		},

		/**
		 * Shuffle the whole box — every table plays with all forty-eight — and draw
		 * the opening claim order at random: one slot per pick a seat gets, so a
		 * duel's two kings land wherever the shuffle puts them.
		 */
		onStart: ( { context }, rng ) => {
			const deck = shuffle( [ ...DOMINO_DECK ], rng( "deck" ).next );

			const selections = getSelectionsPerPlayer( context.players.length );
			const slots = context.players.flatMap(
				( pid ) => Array<PlayerId>( selections ).fill( pid )
			);
			const order = shuffle( slots, rng( "order" ).next );

			return [
				DeckShuffled.make( { deck } ),
				SelectionOrderSet.make( { order } )
			];
		}
	},

	moves: {
		selectDomino: {

			validate: ( { state, context: { players } }, playerId, { dominoId } ) => {
				const entry = state.draft.find( ( e ) => e.domino.id === dominoId );
				if ( !entry ) {
					return new InvalidMove( { move: "selectDomino", reason: "Domino not in draft!" } );
				}

				if ( entry.selectedBy ) {
					return new InvalidMove( { move: "selectDomino", reason: "Domino already selected!" } );
				}

				const selectionsPerPlayer = getSelectionsPerPlayer( players.length );
				const playerSelections = getPlayerSelectionCount( state.draft, playerId );

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

			// Laying is simultaneous: a kingdom is a seat's own business and no
			// placement can reach another one, so anybody still holding a domino may
			// lay it whenever they like. `currentPlayer` tracks the claim order for a
			// client to highlight and for the policy to be scheduled against, but it
			// gates nothing here.
			canMove: ( { state }, playerId ) =>
				( state.playerData[ playerId ]?.queue.length ?? 0 ) > 0,

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

			// The kingdom may have to slide to take the domino. That slide is the
			// move's decision, so both it and the coordinates it leaves the domino at
			// ride the event; the reducer rebuilds the kingdom and its score from them.
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

				return [
					DominoPlaced.make( { playerId, dominoId: placement.dominoId, board, score } )
				];
			}
		},

		discardDomino: {

			// Simultaneous, exactly as laying is — a discard is what laying becomes
			// when the kingdom has no room for the tile.
			canMove: ( { state }, playerId ) =>
				( state.playerData[ playerId ]?.queue.length ?? 0 ) > 0,

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

	/**
	 * Plays the seat the engine is waiting on, from that seat's own view. Kept
	 * strictly legal rather than clever: the engine dies on an illegal policy
	 * move, so every branch answers the same question `validate` is about to ask.
	 */
	botMove: ( { state, context } ) => decideMove( state, context ),

	initialPhase: "SELECT",

	/**
	 * A round is a row of four turned face up, claimed in order, then laid.
	 *
	 * The two halves are separate phases because claiming is strictly ordered and
	 * laying is not: a claim takes a domino out from under everybody else, so it
	 * follows `selectionOrder` one slot at a time, while a placement only ever
	 * touches the seat's own kingdom and can happen whenever that seat likes.
	 */
	phases: {
		SELECT: {
			moves: [ "selectDomino" ],

			/**
			 * Turn the next row face up: four dominoes off the front of the deck,
			 * however many seats are at the table. Nothing is chosen here — the box
			 * was shuffled once at `start` — so the row rides the event and the deck
			 * is sliced by the reducer.
			 */
			onEnter: ( { state } ) => {
				if ( state.deck.length === 0 ) {
					return [];
				}

				const { draft, deck } = drawDraft( state.deck );
				return [ DraftDrawn.make( { draft, deck } ) ];
			},

			resolveStartingPlayer: ( { state, context } ) =>
				state.selectionOrder[ 0 ] ?? context.currentPlayer,

			// One claim per slot, in order: the slot to fill is however many claims
			// the row already holds.
			resolveNextPlayer: ( { state, context } ) => {
				const consumed = state.draft.filter( ( e ) => !!e.selectedBy ).length;
				return state.selectionOrder[ consumed ]
					?? state.selectionOrder[ 0 ]
					?? context.currentPlayer;
			},

			/**
			 * Over once every claim the round has to give has been made — which is a
			 * slot count, not a row count. A table of three claims three of the four,
			 * so waiting for the row to empty would hang the phase forever.
			 */
			endIf: ( { state: { draft, selectionOrder } } ) => {
				const claimed = draft.filter( ( e ) => !!e.selectedBy ).length;
				return draft.length > 0
					&& claimed >= Math.min( selectionOrder.length, draft.length );
			},

			// Whatever nobody wanted leaves the game. A table of three prunes one a
			// round; two and four claim their rows out and prune nothing.
			onExit: ( { state } ) => {
				const unclaimed = state.draft.filter( ( e ) => !e.selectedBy );
				return unclaimed.length === 0
					? []
					: [ DraftPruned.make( { dominoIds: unclaimed.map( ( e ) => e.domino.id ) } ) ];
			},

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

			// The row's numbers become the next round's claim order: whoever took the
			// lowest domino claims first, which is what a low domino was bought with.
			onExit: ( { state } ) => [
				SelectionOrderRecomputed.make( { order: draftPlayerOrder( state.draft ) } )
			],

			resolveNextPhase: () => "SELECT"
		}
	}
} );
