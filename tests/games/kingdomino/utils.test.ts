import { describe, expect, test } from "bun:test";

import { apply } from "@/games/kingdomino/server/utils.ts";
import type {
	Board,
	BoardSize,
	Castle,
	Domino,
	KingdominoState,
	PlayerData,
	Region,
	Tile
} from "@/games/kingdomino/shared/schema.ts";
import {
	DeckShuffled,
	DominoDiscarded,
	DominoPlaced,
	DominoSelected,
	DraftDrawn,
	DraftPruned,
	PlayerBoardCreated,
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
	compareStandings,
	coordKey,
	createBoard,
	decideWinner,
	DOMINO_DECK,
	draftPlayerOrder,
	drawDraft,
	drawDraftPure,
	getBoardBounds,
	getCandidateCells,
	getExactBoardBounds,
	getExpandedBoardBounds,
	getPlacementCoordinates,
	getPlayerSelectionCount,
	getPotentialCells,
	getPotentialCellsForDomino,
	getRowsAndCols,
	getSelectionsPerPlayer,
	getShiftedTiles,
	getValidPlacements,
	getValidRotations,
	largestProperty,
	parseCoordKey,
	rankPlayers,
	TILES,
	totalCrowns
} from "@/games/kingdomino/shared/utils.ts";
import { PlayerId } from "@/shared/swish/schema.ts";

const P1 = PlayerId.make( "p1" );
const P2 = PlayerId.make( "p2" );

/** A hand-built kingdom: only the tile map matters for the pure helpers. */
const kingdom = (
	tiles: Record<string, Tile>,
	size: BoardSize = 5,
	castle: Castle = "red"
) => ( { size, castle, placements: [], tiles } satisfies Board );

/** The board every player starts with: a lone castle at the origin. */
const fresh = ( size: BoardSize = 5 ) => createBoard( "red", size ) as Board;

const tile = ( terrain: Tile["terrain"], crowns = 0 ) => ( { terrain, crowns } satisfies Tile );

/** Sorts coordinates so set-derived results can be compared as a value. */
const sortCoords = ( coords: ReadonlyArray<{ x: number; y: number }> ) =>
	coords.map( coordKey ).toSorted();

// ===========================================================================
describe( "kingdomino/utils — deck", () => {

	test( "the deck holds the 48 canonical dominoes in id order", () => {
		expect( DOMINO_DECK ).toHaveLength( 48 );
		expect( DOMINO_DECK.map( ( d ) => d.id ) )
			.toEqual( Array.from( { length: 48 }, ( _, i ) => i + 1 ) );
	} );

	test( "a domino's id indexes it in the deck — the invariant placement relies on", () => {
		// `applyPlacement`/`isAdjacencyValid` look a domino up as `DOMINO_DECK[ id - 1 ]`,
		// so any renumbering of the deck silently corrupts every placement.
		for ( const domino of DOMINO_DECK ) {
			expect( DOMINO_DECK[ domino.id - 1 ] ).toBe( domino );
		}
	} );

	test( "crown counts per terrain match the tile table", () => {
		expect( TILES.castle ).toEqual( [ { terrain: "castle", crowns: 0 } ] );
		expect( TILES.mine.map( ( t ) => t.crowns ) ).toEqual( [ 0, 1, 2, 3 ] );
		expect( TILES.grassland.map( ( t ) => t.crowns ) ).toEqual( [ 0, 1, 2 ] );
		expect( TILES.forest.map( ( t ) => t.crowns ) ).toEqual( [ 0, 1 ] );
	} );

	test( "there are exactly four castle colours — one per seat", () => {
		expect( CASTLES ).toEqual( [ "red", "blue", "green", "yellow" ] );
	} );
} );

// ===========================================================================
describe( "kingdomino/utils — coordinates", () => {

	test( "a coordinate round-trips through its string key", () => {
		expect( coordKey( { x: 3, y: -2 } ) ).toBe( "3,-2" );
		expect( parseCoordKey( "3,-2" ) ).toEqual( { x: 3, y: -2 } );
	} );

	test( "each rotation extends the anchor in one of the four directions", () => {
		const coord = { x: 2, y: 2 };
		expect( getPlacementCoordinates( { coord, rotation: 0 } ) )
			.toEqual( [ { x: 2, y: 2 }, { x: 3, y: 2 } ] );
		expect( getPlacementCoordinates( { coord, rotation: 90 } ) )
			.toEqual( [ { x: 2, y: 2 }, { x: 2, y: 3 } ] );
		expect( getPlacementCoordinates( { coord, rotation: 180 } ) )
			.toEqual( [ { x: 2, y: 2 }, { x: 1, y: 2 } ] );
		expect( getPlacementCoordinates( { coord, rotation: 270 } ) )
			.toEqual( [ { x: 2, y: 2 }, { x: 2, y: 1 } ] );
	} );
} );

// ===========================================================================
describe( "kingdomino/utils — the sliding 5x5 window", () => {

	test( "an in-bounds placement needs no shift", () => {
		expect( calculateShift( [ { x: 1, y: 1 }, { x: 2, y: 1 } ], 5 ) ).toEqual( { x: 0, y: 0 } );
	} );

	test( "a placement past an edge shifts the whole kingdom back inside", () => {
		expect( calculateShift( [ { x: -1, y: 0 }, { x: 0, y: 0 } ], 5 ) ).toEqual( { x: 1, y: 0 } );
		expect( calculateShift( [ { x: 4, y: 0 }, { x: 5, y: 0 } ], 5 ) ).toEqual( { x: -1, y: 0 } );
		expect( calculateShift( [ { x: 0, y: -1 }, { x: 0, y: 0 } ], 5 ) ).toEqual( { x: 0, y: 1 } );
		expect( calculateShift( [ { x: 0, y: 4 }, { x: 0, y: 5 } ], 5 ) ).toEqual( { x: 0, y: -1 } );
	} );

	test( "a 7x7 kingdom tolerates coordinates a 5x5 one would not", () => {
		expect( calculateShift( [ { x: 5, y: 5 }, { x: 6, y: 5 } ], 7 ) ).toEqual( { x: 0, y: 0 } );
		expect( calculateShift( [ { x: 5, y: 5 }, { x: 6, y: 5 } ], 5 ) ).toEqual( { x: -2, y: -1 } );
	} );

	test( "shifting relocates every tile", () => {
		const shifted = getShiftedTiles( fresh(), { x: 1, y: 2 } );
		expect( shifted ).toEqual( { "1,2": { terrain: "castle", crowns: 0 } } );
	} );

	test( "a shift that would push a tile out of the window is refused", () => {
		expect( getShiftedTiles( fresh(), { x: -1, y: 0 } ) ).toBeNull();
	} );
} );

// ===========================================================================
describe( "kingdomino/utils — placement legality", () => {

	test( "a domino touching the castle is legal — the castle joins any terrain", () => {
		expect( canDominoBePlaced( fresh(), { dominoId: 1, coord: { x: 1, y: 0 }, rotation: 0 } ) )
			.toBe( true );
	} );

	test( "a domino overlapping an occupied square is illegal", () => {
		expect( canDominoBePlaced( fresh(), { dominoId: 1, coord: { x: 0, y: 0 }, rotation: 0 } ) )
			.toBe( false );
	} );

	test( "a domino touching nothing is illegal", () => {
		expect( canDominoBePlaced( fresh(), { dominoId: 1, coord: { x: 3, y: 3 }, rotation: 0 } ) )
			.toBe( false );
	} );

	test( "a domino matching an existing terrain is legal even away from the castle", () => {
		// (2,0) is desert; domino 1 is desert/desert, so (3,0)-(4,0) connects at (3,0).
		const board = kingdom( {
			"0,0": tile( "castle" ),
			"1,0": tile( "desert" ),
			"2,0": tile( "desert" )
		} );

		expect( canDominoBePlaced( board, { dominoId: 1, coord: { x: 3, y: 0 }, rotation: 0 } ) )
			.toBe( true );
	} );

	test( "a domino whose terrains match no neighbour is illegal", () => {
		// Domino 3 is forest/forest; nothing at (3,0)/(4,0)'s neighbours is forest.
		const board = kingdom( {
			"0,0": tile( "castle" ),
			"1,0": tile( "desert" ),
			"2,0": tile( "desert" )
		} );

		expect( canDominoBePlaced( board, { dominoId: 3, coord: { x: 3, y: 0 }, rotation: 0 } ) )
			.toBe( false );
	} );

	test( "either half of the domino may make the connection", () => {
		// Domino 13 is desert/forest. Anchored at (3,0) rotated 180 the FOREST half
		// lands at (3,0) — no match — but the desert half at (2,0)... is occupied.
		// Rotated 0 from (3,0): desert at (3,0) touches desert at (2,0). Legal.
		const board = kingdom( {
			"0,0": tile( "castle" ),
			"1,0": tile( "desert" ),
			"2,0": tile( "desert" )
		} );

		expect( canDominoBePlaced( board, { dominoId: 13, coord: { x: 3, y: 0 }, rotation: 0 } ) )
			.toBe( true );
	} );

	test( "a placement that cannot be shifted back inside the window is illegal", () => {
		// The kingdom already spans x 0..4, so sliding left to fit (5,0)-(6,0) would
		// push the castle to x = -2.
		const board = kingdom( {
			"0,0": tile( "castle" ),
			"4,0": tile( "desert" )
		} );

		expect( canDominoBePlaced( board, { dominoId: 1, coord: { x: 5, y: 0 }, rotation: 0 } ) )
			.toBe( false );
	} );

	test( "getValidRotations reports only the legal orientations at a square", () => {
		// From (1,0) on a fresh kingdom: 180 would cover the castle; the rest connect.
		expect( getValidRotations( fresh(), 1, { x: 1, y: 0 } ) ).toEqual( [ 0, 90, 270 ] );
	} );

	test( "candidate cells are the empty squares touching the kingdom", () => {
		expect( sortCoords( getCandidateCells( fresh() ) ) )
			.toEqual( [ "-1,0", "0,-1", "0,1", "1,0" ] );
	} );

	test( "potential cells are every square a domino could still cover", () => {
		// Every square reachable from the four candidates, in any rotation that stays
		// inside the sliding window — the castle's own square excepted.
		expect( sortCoords( getPotentialCells( fresh() ) ) ).toEqual( [
			"-1,-1", "-1,0", "-1,1", "-2,0",
			"0,-1", "0,-2", "0,1", "0,2",
			"1,-1", "1,0", "1,1", "2,0"
		].toSorted() );
	} );

	test( "potential cells for a domino narrow to the squares its terrain can reach", () => {
		const board = kingdom( {
			"0,0": tile( "castle" ),
			"1,0": tile( "desert" ),
			"2,0": tile( "desert" )
		} );

		const anyDomino = sortCoords( getPotentialCells( board ) );
		// Domino 12 is wasteland/wasteland: it can only touch the castle.
		const wasteland = sortCoords( getPotentialCellsForDomino( board, 12 ) );

		expect( wasteland.length ).toBeGreaterThan( 0 );
		expect( wasteland.length ).toBeLessThan( anyDomino.length );
	} );

	test( "getValidPlacements enumerates every legal (cell, rotation) pair", () => {
		const placements = getValidPlacements( fresh(), 1 );

		expect( placements.length ).toBeGreaterThan( 0 );
		for ( const placement of placements ) {
			expect( placement.dominoId ).toBe( 1 );
			expect( canDominoBePlaced( fresh(), placement ) ).toBe( true );
		}
	} );

	test( "a sealed kingdom has no legal placement left", () => {
		// A 5x5 kingdom with a single hole whose only neighbour is the castle: a
		// domino needs two squares, so nothing fits.
		const tiles: Record<string, Tile> = {};
		for ( let x = 0; x < 5; x++ ) {
			for ( let y = 0; y < 5; y++ ) {
				tiles[ coordKey( { x, y } ) ] = tile( "water" );
			}
		}
		delete tiles[ "0,0" ];

		expect( getValidPlacements( kingdom( tiles ), 7 ) ).toEqual( [] );
	} );

	test( "applyPlacement writes both halves and records the placement", () => {
		const placement = { dominoId: 13, coord: { x: 1, y: 0 }, rotation: 0 as const };
		const board = applyPlacement( fresh(), placement );

		// Domino 13 is desert (left) / forest (right).
		expect( board.tiles[ "1,0" ] ).toEqual( { terrain: "desert", crowns: 0 } );
		expect( board.tiles[ "2,0" ] ).toEqual( { terrain: "forest", crowns: 0 } );
		expect( board.placements ).toEqual( [ placement ] );
		// The source board is untouched.
		expect( Object.keys( fresh().tiles ) ).toEqual( [ "0,0" ] );
	} );

	test( "createBoard seats the castle at the origin", () => {
		expect( createBoard( "green", 7 ) ).toEqual( {
			size: 7,
			castle: "green",
			placements: [],
			tiles: { "0,0": { terrain: "castle", crowns: 0 } }
		} );
	} );
} );

// ===========================================================================
describe( "kingdomino/utils — render bounds", () => {

	test( "the exact bounds are the kingdom's own window", () => {
		expect( getExactBoardBounds( fresh() ) ).toEqual( { minX: 0, maxX: 4, minY: 0, maxY: 4 } );
		expect( getExactBoardBounds( fresh( 7 ) ) ).toEqual( { minX: 0, maxX: 6, minY: 0, maxY: 6 } );
	} );

	test( "the board bounds span the placed tiles, always including the origin", () => {
		const board = kingdom( {
			"0,0": tile( "castle" ),
			"2,3": tile( "forest" ),
			"-1,-2": tile( "water" )
		} );

		expect( getBoardBounds( board ) ).toEqual( { minX: -1, maxX: 2, minY: -2, maxY: 3 } );
	} );

	test( "expanded bounds pad by two but never past the window's reach", () => {
		expect( getExpandedBoardBounds( fresh() ) )
			.toEqual( { minX: -2, maxX: 2, minY: -2, maxY: 2 } );

		// Already spanning the full width: expansion in x collapses to zero.
		const wide = kingdom( { "0,0": tile( "castle" ), "4,0": tile( "desert" ) } );
		expect( getExpandedBoardBounds( wide ) )
			.toEqual( { minX: 0, maxX: 4, minY: -2, maxY: 2 } );
	} );

	test( "getRowsAndCols stretches the grid to cover the possible cells", () => {
		const { rows, cols } = getRowsAndCols(
			{ minX: 0, maxX: 0, minY: 0, maxY: 0 },
			[ { x: 2, y: -1 }, { x: 0, y: 2 } ]
		);

		expect( cols ).toEqual( [ 0, 1, 2 ] );
		expect( rows ).toEqual( [ -1, 0, 1, 2 ] );
	} );

	test( "getRowsAndCols stretches in the negative direction too", () => {
		const { rows, cols } = getRowsAndCols(
			{ minX: 0, maxX: 1, minY: 0, maxY: 1 },
			[ { x: -2, y: -1 } ]
		);

		expect( cols ).toEqual( [ -2, -1, 0, 1 ] );
		expect( rows ).toEqual( [ -1, 0, 1 ] );
	} );
} );

// ===========================================================================
describe( "kingdomino/utils — scoring", () => {

	/** Builds a tile map from a row-major sketch; "." is an empty square. */
	const sketch = ( rows: ReadonlyArray<ReadonlyArray<Tile | null>> ) => {
		const tiles: Record<string, Tile> = {};
		rows.forEach( ( row, y ) => row.forEach( ( t, x ) => {
			if ( t ) {
				tiles[ coordKey( { x, y } ) ] = t;
			}
		} ) );
		return kingdom( tiles );
	};

	const F = ( crowns = 0 ) => tile( "forest", crowns );
	const W = ( crowns = 0 ) => tile( "water", crowns );
	const C = tile( "castle" );

	test( "a lone castle scores nothing", () => {
		expect( calculateScore( fresh() ) ).toEqual( { regions: [], points: 0 } );
	} );

	test( "a territory scores its size times its crowns", () => {
		// Three connected forest tiles carrying two crowns → 3 x 2 = 6.
		const score = calculateScore( sketch( [ [ C, F(), F( 1 ) ], [ null, F( 1 ), null ] ] ) );

		expect( score.points ).toBe( 6 );
		expect( score.regions ).toHaveLength( 1 );
		expect( score.regions[ 0 ] ).toMatchObject( { terrain: "forest", tiles: 3, crowns: 2, points: 6 } );
	} );

	test( "a crownless territory is listed but scores nothing", () => {
		const score = calculateScore( sketch( [ [ C, F(), F() ] ] ) );

		expect( score.points ).toBe( 0 );
		expect( score.regions ).toHaveLength( 1 );
		expect( score.regions[ 0 ] ).toMatchObject( { tiles: 2, crowns: 0, points: 0 } );
	} );

	test( "same-terrain territories that do not touch score separately", () => {
		// Two forest pairs split by a water tile: 2x1 + 2x1, not 4x2.
		const score = calculateScore( sketch( [ [ C, F( 1 ), F(), W(), F(), F( 1 ) ] ] ) );

		expect( score.regions.filter( ( r ) => r.terrain === "forest" ) ).toHaveLength( 2 );
		expect( score.points ).toBe( 4 );
	} );

	test( "diagonal neighbours are not connected", () => {
		const score = calculateScore( sketch( [ [ C, F( 1 ) ], [ null, null, F( 1 ) ] ] ) );

		expect( score.regions ).toHaveLength( 2 );
		expect( score.points ).toBe( 1 + 1 );
	} );

	test( "the castle is excluded from every territory", () => {
		const score = calculateScore( sketch( [ [ C, F( 1 ), F( 1 ) ] ] ) );

		expect( score.regions.map( ( r ) => r.terrain ) ).toEqual( [ "forest" ] );
		expect( score.regions[ 0 ]!.tiles ).toBe( 2 );
	} );

	test( "the total is the sum over every territory", () => {
		const score = calculateScore( sketch( [
			[ C, F( 1 ), F( 1 ) ],
			[ W( 2 ), W(), null ]
		] ) );

		// forest 2x2 = 4, water 2x2 = 4.
		expect( score.points ).toBe( 8 );
		expect( score.regions.map( ( r ) => r.points ).toSorted() ).toEqual( [ 4, 4 ] );
	} );

	test( "a territory is named after the first tile the sweep reaches", () => {
		const score = calculateScore( sketch( [ [ C, F( 1 ), F() ] ] ) );
		expect( score.regions[ 0 ]!.id ).toBe( "forest-1-0" );
		expect( score.regions[ 0 ]!.placement ).toEqual( [ { x: 1, y: 0 }, { x: 2, y: 0 } ] );
	} );
} );

// ===========================================================================
describe( "kingdomino/utils — drafting", () => {

	const deckOf = ( ...ids: number[] ) => ids.map( ( id ) => DOMINO_DECK[ id - 1 ]! ) as Domino[];

	test( "a draft takes four dominoes off the top and sorts them by id", () => {
		const deck = deckOf( 40, 12, 33, 7, 21, 3 );
		const draft = drawDraft( deck );

		expect( draft.map( ( e ) => e.domino.id ) ).toEqual( [ 7, 12, 33, 40 ] );
		expect( draft.every( ( e ) => e.selectedBy === undefined ) ).toBe( true );
		// `drawDraft` splices — the caller's deck shrinks.
		expect( deck.map( ( d ) => d.id ) ).toEqual( [ 21, 3 ] );
	} );

	test( "a short deck yields a short draft", () => {
		const deck = deckOf( 5, 2 );
		expect( drawDraft( deck ).map( ( e ) => e.domino.id ) ).toEqual( [ 2, 5 ] );
		expect( deck ).toHaveLength( 0 );
	} );

	test( "the pure draw leaves the deck alone and returns the remainder", () => {
		const deck = deckOf( 40, 12, 33, 7, 21, 3 );
		const { draft, deck: rest } = drawDraftPure( deck );

		expect( draft.map( ( e ) => e.domino.id ) ).toEqual( [ 7, 12, 33, 40 ] );
		expect( rest.map( ( d ) => d.id ) ).toEqual( [ 21, 3 ] );
		expect( deck.map( ( d ) => d.id ) ).toEqual( [ 40, 12, 33, 7, 21, 3 ] );
	} );

	test( "an exhausted deck draws an empty draft", () => {
		expect( drawDraftPure( [] ) ).toEqual( { draft: [], deck: [] } );
	} );

	test( "two players pick twice a round; three or more pick once", () => {
		expect( getSelectionsPerPlayer( 1 ) ).toBe( 2 );
		expect( getSelectionsPerPlayer( 2 ) ).toBe( 2 );
		expect( getSelectionsPerPlayer( 3 ) ).toBe( 1 );
		expect( getSelectionsPerPlayer( 4 ) ).toBe( 1 );
	} );

	test( "selection counts are per player", () => {
		const draft = [
			{ domino: DOMINO_DECK[ 0 ]!, selectedBy: P1 },
			{ domino: DOMINO_DECK[ 1 ]!, selectedBy: P2 },
			{ domino: DOMINO_DECK[ 2 ]!, selectedBy: P1 },
			{ domino: DOMINO_DECK[ 3 ]! }
		];

		expect( getPlayerSelectionCount( draft, P1 ) ).toBe( 2 );
		expect( getPlayerSelectionCount( draft, P2 ) ).toBe( 1 );
		expect( getPlayerSelectionCount( draft, "nobody" ) ).toBe( 0 );
	} );

	test( "next round's order is the current draft sorted by domino id", () => {
		const draft = [
			{ domino: DOMINO_DECK[ 29 ]!, selectedBy: P2 },
			{ domino: DOMINO_DECK[ 3 ]!, selectedBy: P1 },
			{ domino: DOMINO_DECK[ 19 ]! },
			{ domino: DOMINO_DECK[ 9 ]!, selectedBy: P2 }
		];

		// ids 4, 10, 30 → p1 (lowest) picks first next round; the unpicked id 20 drops.
		expect( draftPlayerOrder( draft ) ).toEqual( [ P1, P2, P2 ] );
	} );
} );

// ===========================================================================
describe( "kingdomino/apply — the pure reducer", () => {

	const base: KingdominoState = {
		playerData: {},
		deck: [],
		draft: [],
		selectionOrder: []
	};

	const withPlayer = ( state: KingdominoState, id: PlayerId ) =>
		apply( state, PlayerBoardCreated.make( { playerId: id, board: fresh() } ) );

	test( "DeckShuffled installs the captured deck", () => {
		const next = apply( base, DeckShuffled.make( { deck: DOMINO_DECK.slice( 0, 3 ) } ) );
		expect( next.deck.map( ( d ) => d.id ) ).toEqual( [ 1, 2, 3 ] );
	} );

	test( "PlayerBoardCreated seats an empty kingdom", () => {
		const next = withPlayer( base, P1 );
		expect( next.playerData[ P1 ] ).toEqual( {
			board: fresh(),
			queue: [],
			score: { regions: [], points: 0 }
		} );
	} );

	test( "SelectionOrderSet and SelectionOrderRecomputed both replace the order", () => {
		const set = apply( base, SelectionOrderSet.make( { order: [ P1, P2 ] } ) );
		expect( set.selectionOrder ).toEqual( [ P1, P2 ] );

		const recomputed = apply( set, SelectionOrderRecomputed.make( { order: [ P2, P1 ] } ) );
		expect( recomputed.selectionOrder ).toEqual( [ P2, P1 ] );
	} );

	test( "DraftDrawn swaps in the drawn entries and the shrunken deck", () => {
		const next = apply( base, DraftDrawn.make( {
			draft: [ { domino: DOMINO_DECK[ 0 ]! } ],
			deck: DOMINO_DECK.slice( 1, 3 )
		} ) );

		expect( next.draft.map( ( e ) => e.domino.id ) ).toEqual( [ 1 ] );
		expect( next.deck.map( ( d ) => d.id ) ).toEqual( [ 2, 3 ] );
	} );

	test( "DominoSelected claims the draft entry and queues the domino", () => {
		const seeded = apply( withPlayer( base, P1 ), DraftDrawn.make( {
			draft: [ { domino: DOMINO_DECK[ 0 ]! }, { domino: DOMINO_DECK[ 1 ]! } ],
			deck: []
		} ) );

		const next = apply( seeded, DominoSelected.make( { dominoId: 2, playerId: P1 } ) );
		expect( next.draft.map( ( e ) => e.selectedBy ) ).toEqual( [ undefined, P1 ] );
		expect( next.playerData[ P1 ]!.queue ).toEqual( [ 2 ] );
	} );

	test( "selecting a domino that left the draft queues nothing", () => {
		// The engine's `validate` rules this out; the reducer stays total regardless
		// — but it must not queue a phantom id either. `placeDomino.validate` gates on
		// `queue.includes( dominoId )`, so a queued 99 would pass that check and then
		// crash dereferencing `DOMINO_DECK[ 98 ]`.
		const next = apply(
			withPlayer( base, P1 ),
			DominoSelected.make( { dominoId: 99, playerId: P1 } )
		);

		expect( next.playerData[ P1 ]!.queue ).toEqual( [] );
	} );

	test( "DraftPruned drops the entries nobody claimed", () => {
		const seeded = apply( base, DraftDrawn.make( {
			draft: [
				{ domino: DOMINO_DECK[ 0 ]!, selectedBy: P1 },
				{ domino: DOMINO_DECK[ 1 ]! }
			],
			deck: []
		} ) );

		expect( apply( seeded, DraftPruned.make( {} ) ).draft.map( ( e ) => e.domino.id ) )
			.toEqual( [ 1 ] );
	} );

	test( "DominoPlaced installs the new kingdom and score and clears the queue slot", () => {
		// Seed the draft first: selecting only queues a domino the draft holds, so
		// without this the queue would start empty and "clears it" would be vacuous.
		const drafted = apply( withPlayer( base, P1 ), DraftDrawn.make( {
			draft: [ { domino: DOMINO_DECK[ 0 ]! } ],
			deck: []
		} ) );

		const seeded = apply( drafted, DominoSelected.make( { dominoId: 1, playerId: P1 } ) );
		expect( seeded.playerData[ P1 ]!.queue ).toEqual( [ 1 ] );

		const board = applyPlacement( fresh(), { dominoId: 1, coord: { x: 1, y: 0 }, rotation: 0 } );
		const next = apply( seeded, DominoPlaced.make( {
			playerId: P1,
			dominoId: 1,
			board,
			score: calculateScore( board )
		} ) );

		expect( next.playerData[ P1 ]!.queue ).toEqual( [] );
		expect( next.playerData[ P1 ]!.board.placements ).toHaveLength( 1 );
		expect( next.playerData[ P1 ]!.score.points ).toBe( 0 );
	} );

	test( "DominoDiscarded clears the queue slot without touching the kingdom", () => {
		const drafted = apply( withPlayer( base, P1 ), DraftDrawn.make( {
			draft: [ { domino: DOMINO_DECK[ 0 ]! } ],
			deck: []
		} ) );

		const seeded = apply( drafted, DominoSelected.make( { dominoId: 1, playerId: P1 } ) );
		expect( seeded.playerData[ P1 ]!.queue ).toEqual( [ 1 ] );

		const next = apply( seeded, DominoDiscarded.make( { playerId: P1, dominoId: 1 } ) );
		expect( next.playerData[ P1 ]!.queue ).toEqual( [] );
		expect( next.playerData[ P1 ]!.board ).toEqual( fresh() );
	} );

	test( "WinnerDecided records the winner", () => {
		expect( apply( base, WinnerDecided.make( { winner: P2 } ) ).winner ).toBe( P2 );
	} );

	test( "the reducer never mutates the state it is given", () => {
		const seeded = withPlayer( base, P1 );
		apply( seeded, DominoSelected.make( { dominoId: 1, playerId: P1 } ) );
		expect( seeded.playerData[ P1 ]!.queue ).toEqual( [] );
	} );
} );

// ===========================================================================
describe( "kingdomino/utils — standings", () => {

	const P3 = PlayerId.make( "p3" );

	/** A region worth `tiles * crowns`, which is how `calculateScore` scores one. */
	const region = ( terrain: Tile["terrain"], tiles: number, crowns: number ) => ( {
		id: `${ terrain }-0-0`,
		terrain,
		tiles,
		placement: [],
		crowns,
		points: tiles * crowns
	} satisfies Region );

	/** A seat whose kingdom holds the given regions. */
	const seat = ( ...regions: Region[] ) => ( {
		board: fresh(),
		queue: [],
		score: { regions, points: regions.reduce( ( sum, r ) => sum + r.points, 0 ) }
	} satisfies PlayerData );

	test( "largestProperty takes the biggest region, crowned or not", () => {
		expect( largestProperty( seat( region( "forest", 3, 2 ), region( "water", 7, 0 ) ).score ) )
			.toBe( 7 );
		expect( largestProperty( { regions: [], points: 0 } ) ).toBe( 0 );
		expect( largestProperty( undefined ) ).toBe( 0 );
	} );

	test( "totalCrowns sums every region", () => {
		expect( totalCrowns( seat( region( "forest", 3, 2 ), region( "mine", 1, 3 ) ).score ) )
			.toBe( 5 );
		expect( totalCrowns( undefined ) ).toBe( 0 );
	} );

	test( "compareStandings ranks on points first", () => {
		// The runner-up wins both tie-breaks — a larger property (8 to 3) and more
		// crowns (5 to 4) — and still loses, two points short.
		const ahead = seat( region( "mine", 3, 4 ) );
		const behind = seat( region( "water", 2, 5 ), region( "forest", 8, 0 ) );
		expect( compareStandings( ahead, behind ) ).toBeLessThan( 0 );
		expect( compareStandings( behind, ahead ) ).toBeGreaterThan( 0 );
	} );

	test( "compareStandings breaks a points tie on the largest property", () => {
		const tight = seat( region( "forest", 5, 2 ) );
		const sprawling = seat( region( "water", 10, 1 ) );
		expect( compareStandings( sprawling, tight ) ).toBeLessThan( 0 );
		expect( compareStandings( tight, sprawling ) ).toBeGreaterThan( 0 );
	} );

	test( "compareStandings falls through to crowns, then calls it even", () => {
		// Both score 12 off a 6-tile property; p2 carries one more crown.
		const fewer = seat( region( "forest", 6, 2 ) );
		const more = seat( region( "mine", 4, 3 ), region( "water", 6, 0 ) );
		expect( compareStandings( more, fewer ) ).toBeLessThan( 0 );
		expect( compareStandings( fewer, seat( region( "water", 6, 2 ) ) ) ).toBe( 0 );
	} );

	test( "rankPlayers orders the roster and keeps seating order on a dead draw", () => {
		const data = {
			[ P1 ]: seat( region( "forest", 5, 2 ) ),
			[ P2 ]: seat( region( "water", 10, 1 ) ),
			[ P3 ]: seat( region( "mine", 4, 3 ) )
		};
		// p3 leads on points (12); p1 and p2 tie on 10, split by property size.
		expect( rankPlayers( [ P1, P2, P3 ], data ) ).toEqual( [ P3, P2, P1 ] );

		const drawn = { [ P1 ]: seat( region( "forest", 6, 2 ) ), [ P2 ]: seat( region( "water", 6, 2 ) ) };
		expect( rankPlayers( [ P2, P1 ], drawn ) ).toEqual( [ P2, P1 ] );
	} );

	test( "decideWinner takes the top of the ranking, and nothing from an empty roster", () => {
		const data = { [ P1 ]: seat( region( "forest", 5, 2 ) ), [ P2 ]: seat( region( "water", 10, 1 ) ) };
		expect( decideWinner( [ P1, P2 ], data ) ).toBe( P2 );
		expect( decideWinner( [], {} ) ).toBeUndefined();
	} );

	test( "a seat with no data ranks last", () => {
		expect( decideWinner( [ P1, P2 ], { [ P2 ]: seat( region( "forest", 2, 1 ) ) } ) ).toBe( P2 );
	} );
} );
