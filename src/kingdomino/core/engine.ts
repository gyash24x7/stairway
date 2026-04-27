import type {
	KingdominoConfig,
	KingdominoData,
	KingdominoMoves,
	KingdominoPlayerView,
	KingdominoSharedView
} from "@/kingdomino/core/types";
import {
	applyPlacement,
	calculateScore,
	calculateShift,
	canDominoBePlaced,
	CASTLES,
	createBoard,
	DOMINO_DECK,
	drawDraft,
	getPlacementCoordinates,
	getPlayerSelectionCount,
	getSelectionOrderFromDraft,
	getSelectionsPerPlayer,
	getShiftedTiles,
	getValidPlacements
} from "@/kingdomino/core/utils";
import { AbstractGameEngine } from "@/shared/engine/engine";
import { shuffle } from "@/shared/utils/array";

/**
 * Durable Object game engine for Kingdomino, a tile-drafting and placement game.
 * Uses a phased game structure with SELECT (draft dominoes) and PLACE (place or discard) phases.
 */
export class KingdominoEngine extends AbstractGameEngine<
	KingdominoData,
	KingdominoMoves,
	KingdominoConfig,
	KingdominoSharedView,
	KingdominoPlayerView
> {

	public static readonly NAME = "kingdomino";

	protected readonly structure = this.defineStructure( {
		name: KingdominoEngine.NAME,

		sharedView: ( { state } ) => {
			const { deck, ...rest } = state;
			return rest;
		},

		playerView: ( _data, playerId ) => ( { playerId } ),

		setup: ( _config: KingdominoConfig ) => ( {
			playerData: {},
			deck: shuffle( [ ...DOMINO_DECK ] ),
			draft: [],
			selectionOrder: []
		} ),

		hooks: {
			onJoin: ( { state, config }, playerId ) => {
				const castleIndex = Object.keys( state.playerData ).length;
				state.playerData[ playerId ] = {
					board: createBoard( CASTLES[ castleIndex ], config.boardSize ),
					queue: [],
					score: { regions: [], points: 0 }
				};
				return state;
			},

			onStart: ( { state, context } ) => {
				state.selectionOrder = shuffle( [ ...context.players ] );
				return state;
			},

			onEnd: ( { state, context } ) => {
				const players = context.players;
				state.winner = players.reduce( ( best, pid ) =>
					state.playerData[ pid ].score.points > state.playerData[ best ].score.points
						? pid
						: best
				);

				return state;
			}
		},

		endIf: ( { state, context } ) => {
			const allQueuesEmpty = context.players.every( pid =>
				state.playerData[ pid ].queue.length === 0
			);

			const hasUnselectedDraft = state.draft.some( e => !e.selectedBy );

			return allQueuesEmpty && state.deck.length === 0 && !hasUnselectedDraft;
		},

		initialPhase: "SELECT",

		phases: {
			SELECT: this.definePhase<Pick<KingdominoMoves, "selectDomino">>( {
				onEnter: ( { state } ) => {
					if ( state.deck.length > 0 ) {
						state.draft = drawDraft( state.deck );
					}
					return state;
				},

				resolveStartingPlayer: ( { state, context } ) => {
					return state.selectionOrder.length > 0
						? state.selectionOrder[ 0 ]
						: context.players[ 0 ];
				},

				moves: {
					selectDomino: {
						validate: ( { state, context: { players } }, playerId, input ) => {
							const entry = state.draft.find( e => e.domino.id === input.dominoId );
							if ( !entry ) {
								throw new Error( "Domino not in draft!" );
							}

							if ( entry.selectedBy ) {
								throw new Error( "Domino already selected!" );
							}

							const selectionsPerPlayer = getSelectionsPerPlayer( players.length );
							const playerSelections = getPlayerSelectionCount( state.draft, playerId );
							if ( playerSelections >= selectionsPerPlayer ) {
								throw new Error( "Already selected maximum dominos this round!" );
							}
						},
						execute: ( { state }, playerId, input ) => {
							const entry = state.draft.find( e => e.domino.id === input.dominoId )!;
							entry.selectedBy = playerId;
							state.playerData[ playerId ].queue.push( input.dominoId );
							return state;
						}
					}
				},

				resolveNextPlayer: ( { state, context } ) => {
					const selectionsPerPlayer = getSelectionsPerPlayer( context.players.length );
					const order = state.selectionOrder.length > 0
						? state.selectionOrder
						: context.players;

					const nextSelector = order.find( pid =>
						getPlayerSelectionCount( state.draft, pid ) < selectionsPerPlayer
					);

					return nextSelector ?? order[ 0 ];
				},

				endIf: ( { state } ) => state.draft.every( e => !!e.selectedBy ),

				resolveNextPhase: () => "PLACE"
			} ),

			PLACE: this.definePhase<Pick<KingdominoMoves, "placeDomino" | "discardDomino">>( {
				resolveStartingPlayer: ( { state } ) => {
					const draftOrder = [ ...state.draft ]
						.filter( e => !!e.selectedBy )
						.sort( ( a, b ) => a.domino.id - b.domino.id )
						.map( e => e.selectedBy! );

					return draftOrder[ 0 ];
				},

				moves: {
					placeDomino: {
						validate: ( { state }, playerId, input ) => {
							const player = state.playerData[ playerId ];
							if ( !player.queue.includes( input.placement.dominoId ) ) {
								throw new Error( "Domino not in your queue!" );
							}

							if ( !canDominoBePlaced( player.board, input.placement ) ) {
								throw new Error( "Invalid placement!" );
							}
						},
						execute: ( { state }, playerId, input ) => {
							const player = state.playerData[ playerId ];
							let placement = input.placement;

							const coords = getPlacementCoordinates( placement );
							const shift = calculateShift( coords, player.board.size );
							if ( shift.x !== 0 || shift.y !== 0 ) {
								const shiftedTiles = getShiftedTiles( player.board, shift );
								if ( shiftedTiles ) {
									player.board.tiles = shiftedTiles;
									placement = {
										...placement,
										coord: {
											x: placement.coord.x + shift.x,
											y: placement.coord.y + shift.y
										}
									};
								}
							}

							player.board = applyPlacement( player.board, placement );
							player.score = calculateScore( player.board );
							player.queue = player.queue.filter( id => id !== input.placement.dominoId );

							return state;
						}
					},

					discardDomino: {
						validate: ( { state }, playerId, input ) => {
							const player = state.playerData[ playerId ];
							if ( !player.queue.includes( input.dominoId ) ) {
								throw new Error( "Domino not in your queue!" );
							}

							const validPlacements = getValidPlacements( player.board, input.dominoId );
							if ( validPlacements.length > 0 ) {
								throw new Error( "Domino can still be placed!" );
							}
						},
						execute: ( { state }, playerId, input ) => {
							const player = state.playerData[ playerId ];
							player.queue = player.queue.filter( id => id !== input.dominoId );
							return state;
						}
					}
				},

				resolveNextPlayer: ( { state } ) => {
					const draftOrder = [ ...state.draft ]
						.filter( e => !!e.selectedBy )
						.sort( ( a, b ) => a.domino.id - b.domino.id )
						.map( e => e.selectedBy! );

					const nextPlacer = draftOrder.find( pid =>
						state.playerData[ pid ].queue.length > 0
					);

					return nextPlacer ?? draftOrder[ 0 ];
				},

				endIf: ( { state, context } ) => {
					return context.players.every(
						pid => state.playerData[ pid ].queue.length === 0
					);
				},

				onExit: ( { state } ) => {
					state.selectionOrder = getSelectionOrderFromDraft( state.draft );
					return state;
				},

				resolveNextPhase: () => "SELECT"
			} )
		}
	} );
}
