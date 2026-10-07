import * as Match from "effect/Match";

import { castDraft, produce } from "immer";

import type {
	Board,
	BoardSize,
	Castle,
	Domino,
	DraftEntry,
	KingdominoEvent,
	KingdominoState,
	Placement,
	PlayerData,
	Rotation,
	ScoreBreakdown,
	Terrain,
	Tile
} from "@/games/kingdomino/schema";
import { Coord, KINGDOMINO_DRAFT_SIZE, Region } from "@/games/kingdomino/schema";
import type { PlayerId } from "@/swish/schema";

/** Rectangular bounding box defined by min/max coordinates. */
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export const TILES = {
	castle: [ { terrain: "castle", crowns: 0 } ],
	desert: [ { terrain: "desert", crowns: 0 }, { terrain: "desert", crowns: 1 } ],
	forest: [ { terrain: "forest", crowns: 0 }, { terrain: "forest", crowns: 1 } ],
	water: [ { terrain: "water", crowns: 0 }, { terrain: "water", crowns: 1 } ],
	grassland: [
		{ terrain: "grassland", crowns: 0 },
		{ terrain: "grassland", crowns: 1 },
		{ terrain: "grassland", crowns: 2 }
	],
	wasteland: [
		{ terrain: "wasteland", crowns: 0 },
		{ terrain: "wasteland", crowns: 1 },
		{ terrain: "wasteland", crowns: 2 }
	],
	mine: [
		{ terrain: "mine", crowns: 0 },
		{ terrain: "mine", crowns: 1 },
		{ terrain: "mine", crowns: 2 },
		{ terrain: "mine", crowns: 3 }
	]
} as const;

export const DOMINO_DECK: Domino[] = [
	{ id: 1, left: TILES.desert[ 0 ], right: TILES.desert[ 0 ] },
	{ id: 2, left: TILES.desert[ 0 ], right: TILES.desert[ 0 ] },
	{ id: 3, left: TILES.forest[ 0 ], right: TILES.forest[ 0 ] },
	{ id: 4, left: TILES.forest[ 0 ], right: TILES.forest[ 0 ] },
	{ id: 5, left: TILES.forest[ 0 ], right: TILES.forest[ 0 ] },
	{ id: 6, left: TILES.forest[ 0 ], right: TILES.forest[ 0 ] },
	{ id: 7, left: TILES.water[ 0 ], right: TILES.water[ 0 ] },
	{ id: 8, left: TILES.water[ 0 ], right: TILES.water[ 0 ] },
	{ id: 9, left: TILES.water[ 0 ], right: TILES.water[ 0 ] },
	{ id: 10, left: TILES.grassland[ 0 ], right: TILES.grassland[ 0 ] },
	{ id: 11, left: TILES.grassland[ 0 ], right: TILES.grassland[ 0 ] },
	{ id: 12, left: TILES.wasteland[ 0 ], right: TILES.wasteland[ 0 ] },

	{ id: 13, left: TILES.desert[ 0 ], right: TILES.forest[ 0 ] },
	{ id: 14, left: TILES.desert[ 0 ], right: TILES.water[ 0 ] },
	{ id: 15, left: TILES.desert[ 0 ], right: TILES.grassland[ 0 ] },
	{ id: 16, left: TILES.desert[ 0 ], right: TILES.wasteland[ 0 ] },
	{ id: 17, left: TILES.forest[ 0 ], right: TILES.water[ 0 ] },
	{ id: 18, left: TILES.forest[ 0 ], right: TILES.grassland[ 0 ] },

	{ id: 19, left: TILES.desert[ 1 ], right: TILES.forest[ 0 ] },
	{ id: 20, left: TILES.desert[ 1 ], right: TILES.water[ 0 ] },
	{ id: 21, left: TILES.desert[ 1 ], right: TILES.grassland[ 0 ] },
	{ id: 22, left: TILES.desert[ 1 ], right: TILES.wasteland[ 0 ] },
	{ id: 23, left: TILES.desert[ 1 ], right: TILES.mine[ 0 ] },

	{ id: 24, left: TILES.forest[ 1 ], right: TILES.desert[ 0 ] },
	{ id: 25, left: TILES.forest[ 1 ], right: TILES.desert[ 0 ] },
	{ id: 26, left: TILES.forest[ 1 ], right: TILES.desert[ 0 ] },
	{ id: 27, left: TILES.forest[ 1 ], right: TILES.desert[ 0 ] },
	{ id: 28, left: TILES.forest[ 1 ], right: TILES.water[ 0 ] },
	{ id: 29, left: TILES.forest[ 1 ], right: TILES.grassland[ 0 ] },

	{ id: 30, left: TILES.water[ 1 ], right: TILES.desert[ 0 ] },
	{ id: 31, left: TILES.water[ 1 ], right: TILES.desert[ 0 ] },
	{ id: 32, left: TILES.water[ 1 ], right: TILES.forest[ 0 ] },
	{ id: 33, left: TILES.water[ 1 ], right: TILES.forest[ 0 ] },
	{ id: 34, left: TILES.water[ 1 ], right: TILES.forest[ 0 ] },
	{ id: 35, left: TILES.water[ 1 ], right: TILES.forest[ 0 ] },

	{ id: 36, left: TILES.grassland[ 1 ], right: TILES.desert[ 0 ] },
	{ id: 37, left: TILES.grassland[ 1 ], right: TILES.water[ 0 ] },

	{ id: 38, left: TILES.wasteland[ 1 ], right: TILES.desert[ 0 ] },
	{ id: 39, left: TILES.wasteland[ 1 ], right: TILES.grassland[ 0 ] },

	{ id: 40, left: TILES.mine[ 1 ], right: TILES.desert[ 0 ] },

	{ id: 41, left: TILES.grassland[ 2 ], right: TILES.desert[ 0 ] },
	{ id: 42, left: TILES.grassland[ 2 ], right: TILES.water[ 0 ] },

	{ id: 43, left: TILES.wasteland[ 2 ], right: TILES.desert[ 0 ] },
	{ id: 44, left: TILES.wasteland[ 2 ], right: TILES.grassland[ 0 ] },

	{ id: 45, left: TILES.mine[ 2 ], right: TILES.desert[ 0 ] },
	{ id: 46, left: TILES.mine[ 2 ], right: TILES.wasteland[ 0 ] },
	{ id: 47, left: TILES.mine[ 2 ], right: TILES.wasteland[ 0 ] },
	{ id: 48, left: TILES.mine[ 3 ], right: TILES.desert[ 0 ] }
];

/**
 * Looks a domino up by id. `DOMINO_DECK` is a dense 1-based array, so the id is
 * the index plus one — but the subtraction is only safe for an id the deck
 * actually holds, and an out-of-range one yields `undefined` rather than
 * throwing on the caller's `.left`/`.right`. Every lookup goes through here so
 * an unknown id degrades instead of crashing.
 *
 * @param dominoId - The 1-based domino id.
 * @returns The domino, or `undefined` if no such id exists.
 */
export const getDomino = ( dominoId: number ) => DOMINO_DECK[ dominoId - 1 ];

/**
 * The four orthogonal steps, in rotation order: right, down, left, up. Doubling
 * as the rotation table is why the order matters — index `n` is the offset for
 * `ALL_ROTATIONS[ n ]`.
 */
export const NEIGHBOR_OFFSETS = [
	{ x: 1, y: 0 },
	{ x: 0, y: 1 },
	{ x: -1, y: 0 },
	{ x: 0, y: -1 }
] as const;

/**
 * Convert a coordinate to a string key for use in objects.
 * @param coord - The coordinate to convert.
 * @returns A string key representing the coordinate.
 */
export function coordKey( coord: Coord ) {
	return `${ coord.x },${ coord.y }`;
}

/**
 * Parse a coordinate key back into a Coord object.
 * @param key - The string key to parse.
 * @returns A Coord object representing the coordinate.
 */
export function parseCoordKey( key: string ) {
	const [ x = 0, y = 0 ] = key.split( "," ).map( Number );
	return Coord.make( { x, y } );
}

/**
 * Get the coordinates of both tiles for a given placement.
 * @param placement - The placement to calculate coordinates for.
 * @returns An array of two Coord objects representing the positions of the placed domino.
 */
export function getPlacementCoordinates( { coord, rotation }: Omit<Placement, "dominoId"> ) {
	const dirs = {
		0: NEIGHBOR_OFFSETS[ 0 ],
		90: NEIGHBOR_OFFSETS[ 1 ],
		180: NEIGHBOR_OFFSETS[ 2 ],
		270: NEIGHBOR_OFFSETS[ 3 ]
	} as const;

	const d = dirs[ rotation ];

	return [
		{ x: coord.x, y: coord.y },
		{ x: coord.x + d.x, y: coord.y + d.y }
	] as const;
}

/**
 * Check if the current tile placements have a valid connection to existing tiles.
 * A valid connection means that the new tile being placed is
 *  - Adjacent to at least one tile of the same terrain
 *  - OR adjacent to the castle (which can connect to any terrain)
 *
 * @param tiles - The current tile placements on the board.
 * @param coord - The coordinate of the new tile being placed.
 * @param terrain - The terrain type of the new tile being placed.
 * @returns True if there is a valid connection, false otherwise.
 */
function hasConnection( tiles: Board["tiles"], coord: Coord, terrain: Terrain ) {

	for ( const { x: dx, y: dy } of NEIGHBOR_OFFSETS ) {
		const cell = tiles[ coordKey( { x: coord.x + dx, y: coord.y + dy } ) ];
		if ( !cell ) {
			continue;
		}

		if ( cell.terrain === terrain || cell.terrain === "castle" ) {
			return true;
		}
	}

	return false;
}

/**
 * Apply a shift to the current tile placements and return the new tile mapping.
 * This is used to adjust the entire board when a new placement would go out of bounds,
 * allowing us to "slide" all tiles back into the board.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param shift - The amount to shift in x and y directions, calculated based on the new placement.
 * @returns A new Board["tiles"] mapping with all tiles shifted accordingly,
 * or null if the shift would still result in out-of-bounds placements.
 */
export function getShiftedTiles(
	board: Board,
	shift: ReturnType<typeof calculateShift>
) {

	const newTiles: Record<string, Tile> = {};

	for ( const key in board.tiles ) {
		const { x, y } = parseCoordKey( key );
		const tile = board.tiles[ key ];

		const nx = x + shift.x;
		const ny = y + shift.y;

		if ( nx < 0 || nx >= board.size || ny < 0 || ny >= board.size || !tile ) {
			return null; // shift invalid
		}

		newTiles[ coordKey( { x: nx, y: ny } ) ] = tile;
	}

	return newTiles;
}

/**
 * Calculate the necessary shift to apply to the current tile placements
 * to fit within the board bounds. If any tile is out of bounds,
 * calculate how much we need to shift all tiles to bring them back within bounds.
 *
 * @param tiles - The current tile placements on the board.
 * @param boardSize - The size of the board (5 or 7).
 * @returns An object with x and y properties indicating how much to shift in each direction.
 */
export function calculateShift( [ p1, p2 ]: readonly [ Coord, Coord ], boardSize: BoardSize ) {
	let minX = Math.min( p1.x, p2.x );
	let maxX = Math.max( p1.x, p2.x );
	let minY = Math.min( p1.y, p2.y );
	let maxY = Math.max( p1.y, p2.y );

	let dx = 0;
	let dy = 0;

	if ( minX < 0 ) {
		dx = -minX;
	}
	if ( maxX > boardSize - 1 ) {
		dx = boardSize - 1 - maxX;
	}

	if ( minY < 0 ) {
		dy = -minY;
	}
	if ( maxY > boardSize - 1 ) {
		dy = boardSize - 1 - maxY;
	}

	return { x: dx, y: dy };
}

/**
 * Check if the proposed placement of a domino is correct according to the game rules.
 * This includes checking that neither tile position is already occupied
 * and that the placement is within bounds (with potential shifting).
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param coords - An array of two Coord objects representing the positions of the placement.
 * @returns True if the placement is correct, false otherwise.
 */
function isPlacementWithinBounds( board: Board, [ p1, p2 ]: [ Coord, Coord ] ) {
	// Check that neither position is already occupied
	if ( board.tiles[ coordKey( p1 ) ] || board.tiles[ coordKey( p2 ) ] ) {
		return false;
	}

	// Validate if the placement is within bounds (with potential shifting)
	const shift = calculateShift( [ p1, p2 ], board.size );
	if ( shift.x !== 0 || shift.y !== 0 ) {
		const shifted = getShiftedTiles( board, shift );
		if ( !shifted ) {
			return false;
		}
	}

	return true;
}

/**
 * Check if the proposed placement of a domino has a valid adjacency to existing tiles.
 * A valid adjacency means that at least one of the new tiles connects to an existing tile
 * of the same terrain type or to the castle.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param coords - An array of two Coord objects representing the positions of the placement.
 * @param dominoId - The ID of the domino, used to determine the terrain types of the new tiles.
 * @returns True if there is a valid adjacency, false otherwise.
 */
function isAdjacencyValid( board: Board, [ p1, p2 ]: [ Coord, Coord ], dominoId: number ) {
	const domino = getDomino( dominoId );

	// An id outside the deck has no terrain to connect, so it is never a legal
	// adjacency — this is what turns a bad `dominoId` into a rejected move
	// (`canDominoBePlaced` → `InvalidMove`) instead of a `TypeError`.
	if ( !domino ) {
		return false;
	}

	// Check adjacency: at least one tile must connect to gameing terrain or castle
	const canLeftConnect = hasConnection( board.tiles, p1, domino.left.terrain );
	const canRightConnect = hasConnection( board.tiles, p2, domino.right.terrain );

	return canLeftConnect || canRightConnect;
}

/**
 * Validate if a proposed domino placement is legal according to the game rules.
 * This includes checking that the placement does not overlap existing tiles,
 * verifying it fits within the board bounds (with potential shifting),
 * and confirming it connects to existing terrain.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param placement - The proposed placement to validate.
 * @returns True if the placement is valid, false otherwise.
 */
export function canDominoBePlaced( board: Board, placement: Placement ) {
	// Determine the two tile positions based on orientation
	const [ p1, p2 ] = getPlacementCoordinates( placement );

	if ( !isPlacementWithinBounds( board, [ p1, p2 ] ) ) {
		return false;
	}

	// Check adjacency: at least one tile must connect to gameing terrain or castle
	return isAdjacencyValid( board, [ p1, p2 ], placement.dominoId );
}

export const ALL_ROTATIONS: Rotation[] = [ 0, 90, 180, 270 ];

/**
 * Returns the rotations under which the given domino can legally be
 * placed at the supplied coordinate.
 */
export function getValidRotations( board: Board, dominoId: number, coord: Coord ) {
	return ALL_ROTATIONS.filter( rotation => canDominoBePlaced(
		board,
		{ dominoId, coord, rotation }
	) );
}

/**
 * Get a list of candidate cells for placing a new domino.
 * These are empty cells that are adjacent to existing tiles.
 * This helps to limit the search space when looking for valid placements.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @returns A array of string keys representing the coordinates of candidates for new placements.
 */
export function getCandidateCells( board: Board ) {
	const set = new Set<Coord>();

	for ( const key in board.tiles ) {
		const { x, y } = parseCoordKey( key );

		for ( const { x: dx, y: dy } of NEIGHBOR_OFFSETS ) {
			const coord = { x: x + dx, y: y + dy };
			if ( !board.tiles[ coordKey( coord ) ] ) {
				set.add( coord );
			}
		}
	}

	return Array.from( set );
}

/**
 * Get a list of potential cells that could be occupied by a new domino placement.
 * This function considers all candidate cells and checks all possible rotations
 * to determine which cells could potentially be occupied by a valid domino placement.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @returns An coordintes representing potential cells that can be occupied.
 */
export function getPotentialCells( board: Board ) {
	const occupied = new Set<string>();
	const candidates = getCandidateCells( board );
	const rotations: Rotation[] = [ 0, 90, 180, 270 ];

	for ( const coord of candidates ) {
		for ( const rotation of rotations ) {
			const [ p1, p2 ] = getPlacementCoordinates( { coord, rotation } );

			// check if placement is correct (within bounds and no overlap)
			if ( !isPlacementWithinBounds( board, [ p1, p2 ] ) ) {
				continue;
			}

			occupied.add( coordKey( p1 ) );
			occupied.add( coordKey( p2 ) );
		}
	}

	return [ ...occupied ].map( parseCoordKey );
}

/**
 * Get a list of potential cells that could be occupied by a specific domino placement.
 * This function considers all candidate cells and checks all possible rotations
 * to determine which cells could potentially be occupied by a valid placement of the specified domino.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param dominoId - The ID of the domino to consider for potential placements.
 * @returns An coordintes representing potential cells that can be occupied by the domino.
 */
export function getPotentialCellsForDomino( board: Board, dominoId: number ) {
	const occupied = new Set<string>();
	const candidates = getPotentialCells( board );
	const rotations: Rotation[] = [ 0, 90, 180, 270 ];

	for ( const coord of candidates ) {
		for ( const rotation of rotations ) {
			const [ p1, p2 ] = getPlacementCoordinates( { coord, rotation } );

			if ( !isAdjacencyValid( board, [ p1, p2 ], dominoId ) ) {
				continue;
			}

			occupied.add( coordKey( p1 ) );
			occupied.add( coordKey( p2 ) );
		}
	}

	return [ ...occupied ].map( parseCoordKey );
}

/**
 * Get the bounding box of the current tile placements on the board.
 * This function iterates over all placed tiles to find the minimum and maximum x and y coordinates,
 * which can be used to determine the area of the board that needs to be
 * rendered or considered for new placements.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @return The minimum and maximum x and y coordinates of the placed tiles on the board.
 */
export function getBoardBounds( board: Board ) {
	let minX = 0;
	let maxX = 0;
	let minY = 0;
	let maxY = 0;

	for ( const key in board.tiles ) {
		const { x, y } = parseCoordKey( key );
		if ( x < minX ) {
			minX = x;
		}

		if ( x > maxX ) {
			maxX = x;
		}

		if ( y < minY ) {
			minY = y;
		}

		if ( y > maxY ) {
			maxY = y;
		}
	}

	return { minX, maxX, minY, maxY };
}

/**
 * Get the expanded bounding box of the current tile placements on the board,
 * clamped so the rendered grid never extends beyond what a placement could
 * actually reach within the board's `size` window. Once the current span
 * already fills `size` in an axis, expansion in that axis collapses to zero.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @return The expanded minimum and maximum x and y coordinates of the placed tiles on the board.
 */
export function getExpandedBoardBounds( board: Board ) {
	const bounds = getBoardBounds( board );
	const max = board.size - 1;
	return {
		minX: Math.max( bounds.minX - 2, bounds.maxX - max ),
		maxX: Math.min( bounds.maxX + 2, bounds.minX + max ),
		minY: Math.max( bounds.minY - 2, bounds.maxY - max ),
		maxY: Math.min( bounds.maxY + 2, bounds.minY + max )
	};
}

/**
 * Get the rows and columns that should be rendered based on
 * the current board state and potential placements.
 * This function calculates the bounding box of existing tiles
 * and expands it to include any potential cells that could be
 * occupied by new placements, ensuring that the rendered grid includes all relevant cells.
 *
 * @param bounds - The current bounding box of existing tiles on the board.
 * @param possibleCells - The coordinates representing potential cells for new placements.
 * @returns An object containing arrays of row and column indices to render.
 */
export function getRowsAndCols( { minX, maxX, maxY, minY }: Bounds, possibleCells: Coord[] ) {
	// Expand only as far as the possible cells reach
	for ( const { x, y } of possibleCells ) {
		if ( x < minX ) {
			minX = x;
		}
		if ( x > maxX ) {
			maxX = x;
		}
		if ( y < minY ) {
			minY = y;
		}
		if ( y > maxY ) {
			maxY = y;
		}
	}

	const rows: number[] = [];
	for ( let y = minY; y <= maxY; y += 1 ) {
		rows.push( y );
	}

	const cols: number[] = [];
	for ( let x = minX; x <= maxX; x += 1 ) {
		cols.push( x );
	}

	return { rows, cols };
}

/**
 * Get a list of valid placements for a given domino on the current board.
 * This function iterates over candidate cells and all possible
 * rotations to find legal placements according to game rules.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param dominoId - The ID of the domino to place.
 * @returns Valid placements for the specified domino.
 */
export function getValidPlacements( board: Board, dominoId: number ) {
	const placements: Placement[] = [];
	const seen = new Set<string>();

	const rotations: Rotation[] = [ 0, 90, 180, 270 ];

	const anchors = getCandidateCells( board ).flatMap( coord => [
		coord,
		...rotations.map( rotation => getPlacementCoordinates( { coord, rotation } )[ 1 ] )
	] );

	for ( const coord of anchors ) {
		for ( const rotation of rotations ) {
			const key = `${ coordKey( coord ) }:${ rotation }`;

			if ( seen.has( key ) ) {
				continue;
			}

			seen.add( key );

			const placement: Placement = {
				dominoId,
				coord,
				rotation
			};

			if ( canDominoBePlaced( board, placement ) ) {
				placements.push( placement );
			}
		}
	}

	return placements;
}

/**
 * Create a new board with a castle tile at the origin.
 *
 * @param castle - The castle color for this player.
 * @param boardSize - The size of the board (5x5 or 7x7).
 * @returns A new Board object with the castle placed at (0,0).
 */
export function createBoard( castle: Castle, boardSize: BoardSize ) {
	return {
		size: boardSize,
		castle,
		placements: [],
		tiles: { [ coordKey( { x: 0, y: 0 } ) ]: { terrain: "castle" as const, crowns: 0 } }
	};
}


// --- Pure reducer ----------------------------------------------------------

/** Pure reducer — the ONLY place `state` changes. Mutations are on an immer draft. */
export const apply = (
	state: KingdominoState,
	event: KingdominoEvent
) =>
	produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "kingdomino/ev/DeckShuffled", ( e ) => { draft.deck = castDraft( e.deck ); } ),
			Match.tag( "kingdomino/ev/PlayerBoardCreated", ( e ) => {
				draft.playerData[ e.playerId ] = castDraft( {
					board: e.board,
					queue: [],
					score: { regions: [], points: 0 }
				} );
			} ),
			Match.tag(
				"kingdomino/ev/SelectionOrderSet",
				( e ) => { draft.selectionOrder = castDraft( e.order ); }
			),
			Match.tag( "kingdomino/ev/DraftDrawn", ( e ) => {
				draft.draft = castDraft( e.draft );
				draft.deck = castDraft( e.deck );
			} ),
			Match.tag( "kingdomino/ev/DominoSelected", ( e ) => {
				// Queue only a domino that is actually in the row. Queuing one that
				// isn't used to be the head of a crash chain: `placeDomino.validate`
				// gates on `queue.includes( dominoId )`, so a phantom id passed that
				// check and then blew up dereferencing the deck in `canDominoBePlaced`.
				const entry = draft.draft.find( ( x ) => x.domino.id === e.dominoId );
				if ( !entry ) {
					return;
				}

				entry.selectedBy = e.playerId;
				draft.playerData[ e.playerId ]!.queue.push( e.dominoId );
			} ),
			Match.tag( "kingdomino/ev/DominoPlaced", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				player.board = castDraft( e.board );
				player.score = castDraft( e.score );
				player.queue = player.queue.filter( ( id ) => id !== e.dominoId );
			} ),
			Match.tag( "kingdomino/ev/DominoDiscarded", ( e ) => {
				const player = draft.playerData[ e.playerId ];
				if ( !player ) {
					return;
				}

				player.queue = player.queue.filter( ( id ) => id !== e.dominoId );
			} ),
			Match.tag( "kingdomino/ev/DraftPruned", ( e ) => {
				// Out of the game, not back into the deck: a row is always four and a
				// table of three only ever claims three of them.
				draft.draft = draft.draft.filter( ( entry ) => !e.dominoIds.includes( entry.domino.id ) );
			} ),
			Match.tag(
				"kingdomino/ev/SelectionOrderRecomputed",
				( e ) => { draft.selectionOrder = castDraft( e.order ); }
			),
			Match.exhaustive
		);
	} );

// --- Board scoring and draft -----------------------------------------------

export const CASTLES = [ "red", "blue", "green", "yellow" ] as const;

/**
 * Get the exact bounds of the board based on its size.
 * This function returns the minimum and maximum x and y coordinates that define the board's area,
 * which can be used for rendering the grid or validating placements against the board limits.
 *
 * @param board - The current state of the board, including its size.
 * @return An object containing the minimum and maximum x and y coordinates of the board.
 */
export function getExactBoardBounds( board: Board ) {
	return { minX: 0, maxX: board.size - 1, minY: 0, maxY: board.size - 1 };
}

/**
 * Apply a domino placement to the board, returning a new board state with the placement added.
 * This function updates the tiles mapping with the new domino's terrain and crowns,
 * and adds the placement to the list of placements on the board.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param placement - The placement to apply to the board.
 * @returns Updated board after applying the placement.
 */
export function applyPlacement( board: Board, placement: Placement ) {
	const domino = getDomino( placement.dominoId );

	// Defence in depth: `canDominoBePlaced` already rejects an unknown id, so
	// reaching here with one means validation was bypassed. Leave the board
	// untouched rather than throwing — this runs inside `execute`, and a total
	// function keeps a bad move a no-op instead of a crash.
	if ( !domino ) {
		return board;
	}

	const [ p1, p2 ] = getPlacementCoordinates( placement );

	const newTiles = { ...board.tiles };

	newTiles[ coordKey( p1 ) ] = domino.left;
	newTiles[ coordKey( p2 ) ] = domino.right;

	return {
		...board,
		placements: [ ...board.placements, placement ],
		tiles: newTiles
	};
}

/**
 * Explore a region of connected tiles of the same terrain type starting from a given coordinate.
 * This function uses a breadth-first search (BFS) approach to find all connected tiles,
 * counting the number of tiles and crowns in the region to calculate the score.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param start - The starting coordinate for the region exploration.
 * @param terrain - The terrain type to game for the region.
 * @param visited - A set of visited coordinates to avoid reprocessing tiles.
 * @returns A Region object representing the explored region, or null if no valid region is found.
 */
function exploreRegion(
	board: Board,
	start: Coord,
	terrain: Terrain,
	visited: Set<string>
) {

	const queue: Coord[] = [ start ];
	const coords: Coord[] = [];
	let crowns = 0;

	while ( queue.length ) {

		const current = queue.shift()!;
		const key = coordKey( current );

		if ( visited.has( key ) ) {
			continue;
		}

		const tile = board.tiles[ key ];
		if ( !tile ) {
			continue;
		}
		if ( tile.terrain !== terrain ) {
			continue;
		}

		visited.add( key );
		coords.push( current );

		crowns += tile.crowns;

		for ( const { x: dx, y: dy } of NEIGHBOR_OFFSETS ) {
			queue.push( {
				x: current.x + dx,
				y: current.y + dy
			} );
		}
	}

	if ( coords.length === 0 ) {
		return null;
	}

	const tiles = coords.length;
	const points = tiles * crowns;

	return Region.make( {
		id: `${ terrain }-${ coords[ 0 ]?.x }-${ coords[ 0 ]?.y }`,
		terrain,
		tiles,
		placement: coords,
		crowns,
		points
	} );
}

/**
 * Calculate the score for the current board state by identifying
 * all connected regions of tiles and summing their points.
 * This function iterates over all tiles on the board,
 * using the exploreRegion function to find connected regions
 * of the same terrain type, and accumulates the total points
 * based on the number of tiles and crowns in each region.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @returns A ScoreBreakdown object containing the list of regions and the total points scored.
 */
export function calculateScore( board: Board ) {

	const visited = new Set<string>();
	const regions: Region[] = [];

	for ( const key in board.tiles ) {

		if ( visited.has( key ) ) {
			continue;
		}

		const coord = parseCoordKey( key );
		const tile = board.tiles[ key ];
		if ( !tile ) {
			continue;
		}

		if ( tile.terrain === "castle" ) {
			visited.add( key );
			continue;
		}

		const region = exploreRegion( board, coord, tile.terrain, visited );

		if ( region ) {
			regions.push( region );
		}
	}

	const points = regions.reduce( ( sum, r ) => sum + r.points, 0 );

	return { regions, points };
}

/**
 * Draw dominoes from the deck to create a new draft, sorted by domino ID.
 * Mutates the deck by splicing dominoes from the front.
 *
 * @param deck - The remaining deck of dominoes (mutated in-place).
 * @returns An array of DraftEntry objects for the current round.
 */
export function drawDraft( deck: readonly Domino[] ) {
	const count = Math.min( KINGDOMINO_DRAFT_SIZE, deck.length );
	const drawn = deck.slice( 0, count )
		.slice()
		.sort( ( a, b ) => a.id - b.id )
		.map( ( domino ) => ( { domino } ) );
	const rest = deck.slice( count );
	return { draft: drawn, deck: rest };
}

/**
 * Get the number of domino selections each player makes per round.
 * In 2-player games, each player selects 2 dominoes; otherwise 1.
 *
 * @param playerCount - The number of players in the game.
 * @returns The number of selections per player per round.
 */
export function getSelectionsPerPlayer( playerCount: number ) {
	return playerCount <= 2 ? 2 : 1;
}

/**
 * Count how many dominoes a player has selected in the current draft.
 *
 * @param draft - The current draft entries.
 * @param playerId - The player to count selections for.
 * @returns The number of dominoes selected by this player.
 */
export function getPlayerSelectionCount( draft: readonly DraftEntry[], playerId: string ) {
	return draft.filter( e => e.selectedBy === playerId ).length;
}

/**
 * Determine the player selection order for the next round based on the current draft.
 * Each selected draft entry contributes one slot, ordered by ascending domino id —
 * so a 2-player draft produces 4 slots (2 per player).
 *
 * @param draft - The current draft entries with selections.
 * @returns An ordered array of player IDs for the next round's selection order.
 */
export const draftPlayerOrder = ( draft: readonly DraftEntry[] ) => draft
	.filter( e => !!e.selectedBy )
	.toSorted( ( a, b ) => a.domino.id - b.domino.id )
	.map( e => e.selectedBy! );

// --- Standings -------------------------------------------------------------

/**
 * Tiles in the player's largest single property — the biggest connected area of
 * one terrain, crowned or not. The first tie-break at the end of the game.
 *
 * @param score The player's score breakdown (an unplayed kingdom scores zero).
 */
export function largestProperty( score?: ScoreBreakdown ) {
	return ( score?.regions ?? [] ).reduce( ( max, region ) => Math.max( max, region.tiles ), 0 );
}

/**
 * Every crown in the player's kingdom. The second tie-break. Crowns only ever
 * sit on scored terrain (the castle carries none), so summing the regions
 * counts them all.
 *
 * @param score The player's score breakdown (an unplayed kingdom scores zero).
 */
export function totalCrowns( score?: ScoreBreakdown ) {
	return ( score?.regions ?? [] ).reduce( ( sum, region ) => sum + region.crowns, 0 );
}

/**
 * Order two seats best-first at the end of a game, following the rulebook:
 * most points, then the largest property, then the most crowns. Seats level on
 * all three compare equal — the rules call that a shared victory, and a stable
 * sort leaves them in seating order.
 *
 * @param a The first player's data.
 * @param b The second player's data.
 * @returns Negative when `a` outranks `b`, positive when `b` outranks `a`.
 */
export function compareStandings( a?: PlayerData, b?: PlayerData ) {
	const byPoints = ( b?.score.points ?? 0 ) - ( a?.score.points ?? 0 );
	if ( byPoints !== 0 ) {
		return byPoints;
	}

	const byProperty = largestProperty( b?.score ) - largestProperty( a?.score );
	if ( byProperty !== 0 ) {
		return byProperty;
	}

	return totalCrowns( b?.score ) - totalCrowns( a?.score );
}

/**
 * Rank the roster best-first, applying the full tie-break chain. `toSorted` is
 * stable, so seats that tie on every key stay in seating order.
 *
 * @param players The roster, in seating order.
 * @param playerData Every seat's data.
 */
export function rankPlayers(
	players: ReadonlyArray<PlayerId>,
	playerData: KingdominoState[ "playerData" ]
) {
	return players.toSorted( ( a, b ) => compareStandings( playerData[ a ], playerData[ b ] ) );
}

/**
 * The winner: the top of {@link rankPlayers}, or `undefined` for an empty roster
 * — and for a shared victory. Two seats level on points, largest property and
 * crowns are level on everything the rules break a tie with, so neither one is
 * the winner; the standings still seat them both at rank 1.
 *
 * @param players The roster, in seating order.
 * @param playerData Every seat's data.
 */
export function decideWinner(
	players: ReadonlyArray<PlayerId>,
	playerData: KingdominoState[ "playerData" ]
) {
	const [ first, second ] = rankPlayers( players, playerData );

	if ( first === undefined ) {
		return undefined;
	}

	const shared = second !== undefined
		&& compareStandings( playerData[ first ], playerData[ second ] ) === 0;

	return shared ? undefined : first;
}

/**
 * The final table: seats best-first, each stamped with its kingdom's worth and
 * its place. Ranking is standard competition style — seats level on every key
 * share a place and the next one down skips it — which is what makes a shared
 * victory read as two seats at rank 1 with no winner named.
 *
 * @param players - The roster, in seating order.
 * @param playerData - Every seat's data.
 * @returns The standings the engine stamps onto the completed game.
 */
export function standingsFor(
	players: ReadonlyArray<PlayerId>,
	playerData: KingdominoState[ "playerData" ]
) {
	let rank = 1;
	let previous: PlayerId | undefined;

	const ranking = rankPlayers( players, playerData ).map( ( playerId, index ) => {
		if ( previous !== undefined
			&& compareStandings( playerData[ previous ], playerData[ playerId ] ) !== 0 ) {
			rank = index + 1;
		}

		previous = playerId;
		return { playerId, rank, score: playerData[ playerId ]?.score.points ?? 0 };
	} );

	return { ranking, winner: decideWinner( players, playerData ) };
}


/** The claims already made against the row on the table. */
export const claimsMade = ( state: KingdominoState ) =>
	state.draft.filter( entry => !!entry.selectedBy ).length;

/**
 * How many claims this row is owed. One per slot in the round's order — four at
 * a table of two (two kings each), three at a table of three, which is what
 * leaves the fourth domino unclaimed and bound for {@link DraftPruned}.
 */
export const claimsOwed = ( state: KingdominoState ) =>
	Math.min( state.draft.length, state.selectionOrder.length );

/** Dominoes claimed but not yet laid, across the whole table. */
export const dominoesHeld = ( state: KingdominoState ) => Object.values( state.playerData )
	.reduce( ( total, player ) => total + player.queue.length, 0 );

/**
 * The domino the rules make a seat lay next: the lowest still in its queue.
 *
 * It only ever matters at a table of two, where a seat holds both of its claims
 * at once — and there it is the rule, not a convenience. The kings are placed in
 * id order, so the domino claimed with the earlier king is the one laid first,
 * and the seat is not free to reorder its own round.
 */
export const nextInQueue = ( player?: PlayerData ) =>
	player && player.queue.length > 0 ? Math.min( ...player.queue ) : undefined;

/**
 * The seat holding slot `index` of the round's order, wrapped rather than
 * indexed past the end: the cursor is asked for the next seat before the phase
 * is asked whether it has finished, so the last slot of a round would otherwise
 * name nobody.
 */
export const seatAt = ( state: KingdominoState, index: number, fallback: PlayerId ) =>
	state.selectionOrder.length > 0
		? state.selectionOrder[ index % state.selectionOrder.length ] ?? fallback
		: fallback;

/**
 * Lays a domino on a kingdom, sliding the board back under it when the placement
 * hangs off an edge.
 *
 * A kingdom is a five-by-five *window* over a plane rather than a fixed grid —
 * the castle starts at the origin and the window travels — which is why
 * `canDominoBePlaced` accepts a placement that only fits once everything moves.
 * `applyPlacement` writes tiles where it is told, so the shift is composed on
 * here rather than left out: the bounds check shifts to bring the *new* tiles
 * into the window and then asks whether the old ones survive it, which is only
 * the whole rule while the old ones are known to be inside it already.
 *
 * The stored placements slide with the tiles, so a board's `placements` always
 * agree with what its `tiles` say — a client renders either one and gets the
 * same kingdom.
 */
export const layDomino = ( board: Board, placement: Placement ) => {
	const shift = calculateShift( getPlacementCoordinates( placement ), board.size );

	if ( shift.x === 0 && shift.y === 0 ) {
		return applyPlacement( board, placement );
	}

	const tiles = getShiftedTiles( board, shift );

	// Unreachable behind `canDominoBePlaced`, which refuses a shift the kingdom
	// cannot survive. Leave the board alone rather than throw: this runs inside
	// `execute`, where a total function keeps a bad move a no-op.
	if ( !tiles ) {
		return board;
	}

	const slid = {
		...board,
		tiles,
		placements: board.placements.map( laid => ( {
			...laid,
			coord: { x: laid.coord.x + shift.x, y: laid.coord.y + shift.y }
		} ) )
	};

	return applyPlacement( slid, {
		...placement,
		coord: { x: placement.coord.x + shift.x, y: placement.coord.y + shift.y }
	} );
};
