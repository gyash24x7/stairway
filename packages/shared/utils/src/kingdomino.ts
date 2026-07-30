import type {
	Board,
	BoardSize,
	Castle,
	Domino,
	Placement,
	Rotation,
	ScoreBreakdown,
	Terrain,
	Tile
} from "@s2h/schema/kingdomino";
import { Coord, DraftEntry, Region } from "@s2h/schema/kingdomino";

/** Rectangular bounding box defined by min/max coordinates. */
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

const DRAFT_SIZE = 4;

export const CASTLES = [ "red", "blue", "green", "yellow" ] as const;

export const TILES: Record<Terrain, Tile[]> = {
	castle: [ { terrain: "castle", crowns: 0 } ],
	desert: [ 0, 1 ].map( crowns => ( { terrain: "desert", crowns } ) ),
	forest: [ 0, 1 ].map( crowns => ( { terrain: "forest", crowns } ) ),
	water: [ 0, 1 ].map( crowns => ( { terrain: "water", crowns } ) ),
	grassland: [ 0, 1, 2 ].map( crowns => ( { terrain: "grassland", crowns } ) ),
	wasteland: [ 0, 1, 2 ].map( crowns => ( { terrain: "wasteland", crowns } ) ),
	mine: [ 0, 1, 2, 3 ].map( crowns => ( { terrain: "mine", crowns } ) )
};

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

const neighbors = [
	{ x: 1, y: 0 },
	{ x: 0, y: 1 },
	{ x: -1, y: 0 },
	{ x: 0, y: -1 }
];

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
	const [ x, y ] = key.split( "," ).map( Number );
	return Coord.make( { x, y } );
}

/**
 * Get the coordinates of both tiles for a given placement.
 * @param placement - The placement to calculate coordinates for.
 * @returns An array of two Coord objects representing the positions of the placed domino.
 */
export function getPlacementCoordinates( { coord, rotation }: Omit<Placement, "dominoId"> ) {
	const dirs = {
		0: neighbors[ 0 ],
		90: neighbors[ 1 ],
		180: neighbors[ 2 ],
		270: neighbors[ 3 ]
	};
	const d = dirs[ rotation ];

	return [
		{ x: coord.x, y: coord.y },
		{ x: coord.x + d.x, y: coord.y + d.y }
	];
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

	for ( const { x: dx, y: dy } of neighbors ) {
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

		if ( nx < 0 || nx >= board.size || ny < 0 || ny >= board.size ) {
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
export function calculateShift( [ p1, p2 ]: Coord[], boardSize: BoardSize ) {
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
function isPlacementWithinBounds( board: Board, [ p1, p2 ]: Coord[] ) {
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
function isAdjacencyValid( board: Board, [ p1, p2 ]: Coord[], dominoId: number ) {
	const domino = DOMINO_DECK[ dominoId - 1 ];

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

		for ( const { x: dx, y: dy } of neighbors ) {
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
export function getPotentialCells( board: Board ): Coord[] {
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
export function getPotentialCellsForDomino( board: Board, dominoId: number ): Coord[] {
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
	const cells = getCandidateCells( board );

	const rotations: Rotation[] = [ 0, 90, 180, 270 ];

	for ( const coord of cells ) {
		for ( const rotation of rotations ) {
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
 * Apply a domino placement to the board, returning a new board state with the placement added.
 * This function updates the tiles mapping with the new domino's terrain and crowns,
 * and adds the placement to the list of placements on the board.
 *
 * @param board - The current state of the board, including existing placements and tiles.
 * @param placement - The placement to apply to the board.
 * @returns Updated board after applying the placement.
 */
export function applyPlacement( board: Board, placement: Placement ): Board {
	const domino = DOMINO_DECK[ placement.dominoId - 1 ];
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

		for ( const { x: dx, y: dy } of neighbors ) {
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
		id: `${ terrain }-${ coords[ 0 ].x }-${ coords[ 0 ].y }`,
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
export function calculateScore( board: Board ): ScoreBreakdown {

	const visited = new Set<string>();
	const regions: Region[] = [];

	for ( const key in board.tiles ) {

		if ( visited.has( key ) ) {
			continue;
		}

		const coord = parseCoordKey( key );
		const tile = board.tiles[ key ];

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

/**
 * Draw dominoes from the deck to create a new draft, sorted by domino ID.
 * Mutates the deck by splicing dominoes from the front.
 *
 * @param deck - The remaining deck of dominoes (mutated in-place).
 * @returns An array of DraftEntry objects for the current round.
 */
export function drawDraft( deck: Domino[] ) {
	const count = Math.min( DRAFT_SIZE, deck.length );
	return deck
		.splice( 0, count )
		.sort( ( a, b ) => a.id - b.id )
		.map( domino => DraftEntry.make( { domino } ) );
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
export function getPlayerSelectionCount( draft: DraftEntry[], playerId: string ) {
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

/** Pure, deterministic draft draw from a given deck (no mutation). */
export const drawDraftPure = ( deck: ReadonlyArray<Domino> ) => {
	const count = Math.min( DRAFT_SIZE, deck.length );
	const drawn = deck.slice( 0, count )
		.slice()
		.sort( ( a, b ) => a.id - b.id )
		.map( ( domino ) => ( { domino } ) );
	const rest = deck.slice( count );
	return { draft: drawn, deck: rest };
};
