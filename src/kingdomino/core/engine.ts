import type {
	BoardSize,
	Castle,
	DiscardDominoInput,
	DraftEntry,
	KingdominoConfig,
	KingdominoData,
	KingdominoPlayerView,
	PlaceDominoInput,
	SelectDominoInput
} from "@/kingdomino/core/types";
import type { PlayerId } from "@/shared/engine/types";
import {
	applyPlacement,
	calculateScore,
	calculateShift,
	canDominoBePlaced,
	CASTLES,
	coordKey,
	DOMINO_DECK,
	getPlacementCoordinates,
	getShiftedTiles,
	getValidPlacements
} from "@/kingdomino/core/utils";
import { GameEngine } from "@/shared/engine/engine";
import { shuffle } from "@/shared/utils/array";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "Kingdomino:Engine" );
const DRAFT_SIZE = 4;

function createBoard( castle: Castle, boardSize: BoardSize ) {
	return {
		size: boardSize,
		castle,
		placements: [],
		tiles: { [ coordKey( { x: 0, y: 0 } ) ]: { terrain: "castle" as const, crowns: 0 } }
	};
}

function drawDraft( deck: KingdominoData["deck"] ): DraftEntry[] {
	const count = Math.min( DRAFT_SIZE, deck.length );
	return deck
		.splice( 0, count )
		.sort( ( a, b ) => a.id - b.id )
		.map( domino => ( { domino } ) );
}

function getSelectionsPerPlayer( playerCount: number ): number {
	return playerCount <= 2 ? 2 : 1;
}

function getPlayerSelectionCount( draft: DraftEntry[], playerId: string ): number {
	return draft.filter( e => e.selectedBy === playerId ).length;
}

function getSelectionOrderFromDraft( draft: DraftEntry[] ): PlayerId[] {
	// Order determined by domino ID — whoever picked the lowest domino goes first
	return [ ...draft ]
		.filter( e => !!e.selectedBy )
		.sort( ( a, b ) => a.domino.id - b.domino.id )
		.map( e => e.selectedBy! )
		.filter( ( pid, idx, arr ) => arr.indexOf( pid ) === idx ); // deduplicate for 2-player
}

function checkRoundEnd( state: { data: KingdominoData; ctx: { players: string[] } } ) {
	const allPlaced = state.ctx.players.every( pid =>
		state.data.playerData[ pid ].queue.length === 0
	);

	if ( allPlaced && state.data.deck.length > 0 ) {
		// Derive next selection order from current draft before replacing
		state.data.selectionOrder = getSelectionOrderFromDraft( state.data.draft );
		state.data.draft = drawDraft( state.data.deck );
		state.data.phase = "select";
	}
}

export const kingdominoEngine = new GameEngine( {
	name: "kingdomino",

	getNextPlayer: ( state ) => {
		const { data, ctx } = state;
		const selectionsPerPlayer = getSelectionsPerPlayer( ctx.players.length );
		const order = data.selectionOrder.length > 0 ? data.selectionOrder : ctx.players;

		if ( data.phase === "select" ) {
			const nextSelector = order.find( pid =>
				getPlayerSelectionCount( data.draft, pid ) < selectionsPerPlayer
			);
			return nextSelector ?? order[ 0 ];
		}

		// Place phase — order determined by current draft selection (lowest domino ID places first)
		const draftOrder = [ ...data.draft ]
			.filter( e => !!e.selectedBy )
			.sort( ( a, b ) => a.domino.id - b.domino.id )
			.map( e => e.selectedBy! );

		const nextPlacer = draftOrder.find( pid =>
			data.playerData[ pid ].queue.length > 0
		);

		return nextPlacer ?? order[ 0 ];
	},

	playerView: ( data, _config, playerId ): KingdominoPlayerView => {
		const { deck, ...rest } = data;
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
		onJoin: ( state, config, playerId ) => {
			const castleIndex = Object.keys( state.data.playerData ).length;
			state.data.playerData[ playerId ] = {
				board: createBoard( CASTLES[ castleIndex ], config.boardSize ),
				queue: [],
				score: { regions: [], points: 0 }
			};
			return state.data;
		},

		onStart: ( state, _config ) => {
			state.data.draft = drawDraft( state.data.deck );
			state.data.phase = "select";
			state.data.selectionOrder = shuffle( [ ...state.ctx.players ] );
			return state.data;
		}
	},

	moves: {
		selectDomino: {
			validate: ( state, _config, playerId, input: SelectDominoInput ) => {
				logger.debug( ">> validateSelectDomino()" );

				if ( state.data.phase !== "select" ) {
					throw new Error( "Not in selection phase!" );
				}

				const entry = state.data.draft.find( e => e.domino.id === input.dominoId );
				if ( !entry ) {
					throw new Error( "Domino not in draft!" );
				}

				if ( entry.selectedBy ) {
					throw new Error( "Domino already selected!" );
				}

				const selectionsPerPlayer = getSelectionsPerPlayer( state.ctx.players.length );
				const playerSelections = getPlayerSelectionCount( state.data.draft, playerId );
				if ( playerSelections >= selectionsPerPlayer ) {
					throw new Error( "Already selected maximum dominos this round!" );
				}

				logger.debug( "<< validateSelectDomino()" );
			},
			execute: ( state, _config, playerId, input: SelectDominoInput ) => {
				logger.debug( ">> selectDomino()" );

				const entry = state.data.draft.find( e => e.domino.id === input.dominoId )!;
				entry.selectedBy = playerId;

				state.data.playerData[ playerId ].queue.push( input.dominoId );

				const allSelected = state.data.draft.every( e => !!e.selectedBy );
				if ( allSelected ) {
					state.data.phase = "place";
				}

				logger.debug( "<< selectDomino()" );
				return state.data;
			}
		},

		placeDomino: {
			validate: ( state, _config, playerId, input: PlaceDominoInput ) => {
				logger.debug( ">> validatePlaceDomino()" );

				if ( state.data.phase !== "place" ) {
					throw new Error( "Not in placement phase!" );
				}

				const player = state.data.playerData[ playerId ];
				if ( !player.queue.includes( input.placement.dominoId ) ) {
					throw new Error( "Domino not in your queue!" );
				}

				if ( !canDominoBePlaced( player.board, input.placement ) ) {
					throw new Error( "Invalid placement!" );
				}

				logger.debug( "<< validatePlaceDomino()" );
			},
			execute: ( state, _config, playerId, input: PlaceDominoInput ) => {
				logger.debug( ">> placeDomino()" );

				const player = state.data.playerData[ playerId ];
				let placement = input.placement;

				// Apply shift if needed
				const coords = getPlacementCoordinates( placement );
				const shift = calculateShift( coords, player.board.size );
				if ( shift.x !== 0 || shift.y !== 0 ) {
					const shiftedTiles = getShiftedTiles( player.board, shift );
					if ( shiftedTiles ) {
						player.board.tiles = shiftedTiles;
						// Shift the placement coordinates to match
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

				checkRoundEnd( state );

				logger.debug( "<< placeDomino()" );
				return state.data;
			}
		},

		discardDomino: {
			validate: ( state, _config, playerId, input: DiscardDominoInput ) => {
				logger.debug( ">> validateDiscardDomino()" );

				if ( state.data.phase !== "place" ) {
					throw new Error( "Not in placement phase!" );
				}

				const player = state.data.playerData[ playerId ];
				if ( !player.queue.includes( input.dominoId ) ) {
					throw new Error( "Domino not in your queue!" );
				}

				const validPlacements = getValidPlacements( player.board, input.dominoId );
				if ( validPlacements.length > 0 ) {
					throw new Error( "Domino can still be placed!" );
				}

				logger.debug( "<< validateDiscardDomino()" );
			},
			execute: ( state, _config, playerId, input: DiscardDominoInput ) => {
				logger.debug( ">> discardDomino()" );

				const player = state.data.playerData[ playerId ];
				player.queue = player.queue.filter( id => id !== input.dominoId );

				checkRoundEnd( state );

				logger.debug( "<< discardDomino()" );
				return state.data;
			}
		}
	},

	endIf: ( state, _config ) => {
		const allQueuesEmpty = state.ctx.players.every( pid =>
			state.data.playerData[ pid ].queue.length === 0
		);

		const hasUnselectedDraft = state.data.draft.some( e => !e.selectedBy );

		if ( !allQueuesEmpty || state.data.deck.length > 0 || hasUnselectedDraft ) {
			return undefined;
		}

		const players = state.ctx.players;
		const winner = players.reduce( ( best, pid ) =>
			state.data.playerData[ pid ].score.points > state.data.playerData[ best ].score.points ? pid : best
		);

		return { victory: true, winner };
	}
} );
