import type {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoData,
	KingdominoMoves,
	KingdominoPlayerView,
	PlaceDominoInput,
	SelectDominoInput
} from "@/kingdomino/core/types";
import {
	applyPlacement,
	calculateScore,
	calculateShift,
	canDominoBePlaced,
	CASTLES,
	checkRoundEnd,
	createBoard,
	DOMINO_DECK,
	drawDraft,
	getPlacementCoordinates,
	getPlayerSelectionCount,
	getSelectionsPerPlayer,
	getShiftedTiles,
	getValidPlacements
} from "@/kingdomino/core/utils";
import { AbstractGameEngine } from "@/shared/engine/engine";
import type { GameStructure } from "@/shared/engine/types";
import { shuffle } from "@/shared/utils/array";

export class KingdominoEngine extends AbstractGameEngine<KingdominoData, KingdominoMoves, KingdominoConfig, KingdominoPlayerView> {

	public static readonly NAME = "kingdomino";

	protected readonly structure: GameStructure<KingdominoData, KingdominoMoves, KingdominoConfig, KingdominoPlayerView> = {
		name: KingdominoEngine.NAME,

		getNextPlayer: ( { state, context } ) => {
			const selectionsPerPlayer = getSelectionsPerPlayer( context.players.length );
			const order = state.selectionOrder.length > 0 ? state.selectionOrder : context.players;

			if ( state.phase === "select" ) {
				const nextSelector = order.find( pid =>
					getPlayerSelectionCount( state.draft, pid ) < selectionsPerPlayer
				);
				return nextSelector ?? order[ 0 ];
			}

			// Place phase — order determined by current draft selection (lowest domino ID places first)
			const draftOrder = [ ...state.draft ]
				.filter( e => !!e.selectedBy )
				.sort( ( a, b ) => a.domino.id - b.domino.id )
				.map( e => e.selectedBy! );

			const nextPlacer = draftOrder.find( pid =>
				state.playerData[ pid ].queue.length > 0
			);

			return nextPlacer ?? order[ 0 ];
		},

		playerView: ( { state }, playerId ): KingdominoPlayerView => {
			const { deck, ...rest } = state;
			return { ...rest, playerId };
		},

		setup: ( _config: KingdominoConfig ): KingdominoData => ( {
			playerData: {},
			deck: shuffle( [ ...DOMINO_DECK ] ),
			draft: [],
			phase: "select",
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
				state.draft = drawDraft( state.deck );
				state.phase = "select";
				state.selectionOrder = shuffle( [ ...context.players ] );
				return state;
			},

			onEnd: ( { state, context } ) => {
				const players = context.players;
				state.winner = players.reduce( ( best, pid ) =>
					state.playerData[ pid ].score.points > state.playerData[ best ].score.points ? pid : best
				);

				return state;
			}
		},

		moves: {
			selectDomino: {
				validate: ( { state, context }, playerId, input: SelectDominoInput ) => {
					this.logger.debug( ">> validateSelectDomino()" );

					if ( state.phase !== "select" ) {
						throw new Error( "Not in selection phase!" );
					}

					const entry = state.draft.find( e => e.domino.id === input.dominoId );
					if ( !entry ) {
						throw new Error( "Domino not in draft!" );
					}

					if ( entry.selectedBy ) {
						throw new Error( "Domino already selected!" );
					}

					const selectionsPerPlayer = getSelectionsPerPlayer( context.players.length );
					const playerSelections = getPlayerSelectionCount( state.draft, playerId );
					if ( playerSelections >= selectionsPerPlayer ) {
						throw new Error( "Already selected maximum dominos this round!" );
					}

					this.logger.debug( "<< validateSelectDomino()" );
				},
				execute: ( { state }, playerId, input: SelectDominoInput ) => {
					this.logger.debug( ">> selectDomino()" );

					const entry = state.draft.find( e => e.domino.id === input.dominoId )!;
					entry.selectedBy = playerId;

					state.playerData[ playerId ].queue.push( input.dominoId );

					const allSelected = state.draft.every( e => !!e.selectedBy );
					if ( allSelected ) {
						state.phase = "place";
					}

					this.logger.debug( "<< selectDomino()" );
					return state;
				}
			},

			placeDomino: {
				validate: ( { state }, playerId, input: PlaceDominoInput ) => {
					this.logger.debug( ">> validatePlaceDomino()" );

					if ( state.phase !== "place" ) {
						throw new Error( "Not in placement phase!" );
					}

					const player = state.playerData[ playerId ];
					if ( !player.queue.includes( input.placement.dominoId ) ) {
						throw new Error( "Domino not in your queue!" );
					}

					if ( !canDominoBePlaced( player.board, input.placement ) ) {
						throw new Error( "Invalid placement!" );
					}

					this.logger.debug( "<< validatePlaceDomino()" );
				},
				execute: ( { state, context }, playerId, input: PlaceDominoInput ) => {
					this.logger.debug( ">> placeDomino()" );

					const player = state.playerData[ playerId ];
					let placement = input.placement;

					// Apply shift if needed
					const coords = getPlacementCoordinates( placement );
					const shift = calculateShift( coords, player.board.size );
					if ( shift.x !== 0 || shift.y !== 0 ) {
						const shiftedTiles = getShiftedTiles( player.board, shift );
						if ( shiftedTiles ) {
							player.board.tiles = shiftedTiles;
							// Shift the placement coordinates to game
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
					player.queue = player.queue.filter( id => id !== input.placement.dominoId );
					player.score = calculateScore( player.board );

					checkRoundEnd( state, context );

					this.logger.debug( "<< placeDomino()" );
					return state;
				}
			},

			discardDomino: {
				validate: ( { state }, playerId, input: DiscardDominoInput ) => {
					this.logger.debug( ">> validateDiscardDomino()" );

					if ( state.phase !== "place" ) {
						throw new Error( "Not in placement phase!" );
					}

					const player = state.playerData[ playerId ];
					if ( !player.queue.includes( input.dominoId ) ) {
						throw new Error( "Domino not in your queue!" );
					}

					const validPlacements = getValidPlacements( player.board, input.dominoId );
					if ( validPlacements.length > 0 ) {
						throw new Error( "Domino can still be placed!" );
					}

					this.logger.debug( "<< validateDiscardDomino()" );
				},
				execute: ( { state, context }, playerId, input: DiscardDominoInput ) => {
					this.logger.debug( ">> discardDomino()" );

					const player = state.playerData[ playerId ];
					player.queue = player.queue.filter( id => id !== input.dominoId );

					checkRoundEnd( state, context );

					this.logger.debug( "<< discardDomino()" );
					return state;
				}
			}
		},

		endIf: ( { state, context } ) => {
			const allQueuesEmpty = context.players.every( pid =>
				state.playerData[ pid ].queue.length === 0
			);

			const hasUnselectedDraft = state.draft.some( e => !e.selectedBy );

			return allQueuesEmpty && state.deck.length === 0 && !hasUnselectedDraft;
		}
	};

	protected getInitialState(): { state: KingdominoData; config: KingdominoConfig } {
		return {
			config: { playerCount: 2, boardSize: 7, autoStart: true },
			state: {
				playerData: {},
				deck: shuffle( [ ...DOMINO_DECK ] ),
				draft: [],
				phase: "select",
				selectionOrder: []
			}
		};
	}
}
