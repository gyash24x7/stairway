import * as Match from "effect/Match";
import { castDraft, produce } from "immer";

import { KINGDOMINO_DRAFT_SIZE, Region } from "@/games/kingdomino/shared/schema.ts";
import {
	coordKey,
	getDomino,
	getPlacementCoordinates,
	NEIGHBOR_OFFSETS,
	parseCoordKey
} from "@/games/kingdomino/shared/utils.ts";

import type {
	Board,
	Coord,
	Domino,
	DraftEntry,
	KingdominoEvent,
	KingdominoState,
	Placement,
	PlayerData,
	ScoreBreakdown
, Terrain } from "@/games/kingdomino/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

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
export function calculateScore( board: Board ) {

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
