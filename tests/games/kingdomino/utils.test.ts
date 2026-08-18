import { describe, expect, test } from "bun:test";

import type {
	Board,
	DraftEntry,
	KingdominoState,
	PlayerData,
	Tile
} from "@/games/kingdomino/shared/schema.ts";
import {
	KINGDOMINO_DECK_SIZE,
	KINGDOMINO_DRAFT_SIZE,
	KINGDOMINO_PLAYER_COUNTS
} from "@/games/kingdomino/shared/schema.ts";
import {
	applyPlacement,
	calculateScore,
	compareStandings,
	decideWinner,
	draftPlayerOrder,
	drawDraft,
	getExactBoardBounds,
	getPlayerSelectionCount,
	getSelectionsPerPlayer,
	largestProperty,
	rankPlayers,
	standingsFor,
	totalCrowns
} from "@/games/kingdomino/server/utils.ts";
import {
	ALL_ROTATIONS,
	calculateShift,
	canDominoBePlaced,
	coordKey,
	createBoard,
	DOMINO_DECK,
	getBoardBounds,
	getCandidateCells,
	getDomino,
	getExpandedBoardBounds,
	getPlacementCoordinates,
	getPotentialCells,
	getPotentialCellsForDomino,
	getRowsAndCols,
	getShiftedTiles,
	getValidPlacements,
	getValidRotations,
	parseCoordKey
} from "@/games/kingdomino/shared/utils.ts";
import { PlayerId } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c ] = [ player( "a" ), player( "b" ), player( "c" ) ];

/** A kingdom holding whatever tiles the test names, castle included. */
const kingdom = ( tiles: Record<string, Tile>, size: 5 | 7 = 5 ): Board => ( {
	size,
	castle: "red",
	placements: [],
	tiles: { "0,0": { terrain: "castle", crowns: 0 }, ...tiles }
} );

const tile = ( terrain: Tile[ "terrain" ], crowns = 0 ): Tile => ( { terrain, crowns } );

/** A seat whose kingdom is described by its regions rather than its tiles. */
const seat = ( regions: ReadonlyArray<{ tiles: number; crowns: number }> ): PlayerData => ( {
	board: createBoard( "red", 5 ),
	queue: [],
	score: {
		points: regions.reduce( ( sum, r ) => sum + ( r.tiles * r.crowns ), 0 ),
		regions: regions.map( ( r, index ) => ( {
			id: `region-${ index }`,
			terrain: "forest" as const,
			tiles: r.tiles,
			placement: [],
			crowns: r.crowns,
			points: r.tiles * r.crowns
		} ) )
	}
} );

const claimed = ( id: number, by?: typeof a ): DraftEntry =>
	( { domino: getDomino( id )!, selectedBy: by } );


describe( "the box", () => {
	test( "holds forty-eight dominoes, numbered densely from one", () => {
		expect( DOMINO_DECK ).toHaveLength( KINGDOMINO_DECK_SIZE );
		expect( DOMINO_DECK.map( domino => domino.id ) )
			.toEqual( Array.from( { length: KINGDOMINO_DECK_SIZE }, ( _, i ) => i + 1 ) );
	} );

	test( "looks a domino up by its number, and refuses one it does not hold", () => {
		expect( getDomino( 1 ) ).toBe( DOMINO_DECK[ 0 ]! );
		expect( getDomino( KINGDOMINO_DECK_SIZE ) ).toBe( DOMINO_DECK[ KINGDOMINO_DECK_SIZE - 1 ]! );
		expect( getDomino( 0 ) ).toBeUndefined();
		expect( getDomino( KINGDOMINO_DECK_SIZE + 1 ) ).toBeUndefined();
	} );
} );


describe( "coordinates", () => {
	test( "round-trips through the board's key space", () => {
		expect( coordKey( { x: 2, y: -1 } ) ).toBe( "2,-1" );
		expect( parseCoordKey( "2,-1" ) ).toEqual( { x: 2, y: -1 } );
	} );

	test( "puts the domino's second half on each side in turn", () => {
		const at = ( rotation: 0 | 90 | 180 | 270 ) =>
			getPlacementCoordinates( { coord: { x: 1, y: 1 }, rotation } )[ 1 ]!;

		expect( at( 0 ) ).toEqual( { x: 2, y: 1 } );
		expect( at( 90 ) ).toEqual( { x: 1, y: 2 } );
		expect( at( 180 ) ).toEqual( { x: 0, y: 1 } );
		expect( at( 270 ) ).toEqual( { x: 1, y: 0 } );
	} );
} );


describe( "the kingdom's window", () => {
	test( "slides only as far as a placement hanging off an edge needs", () => {
		expect( calculateShift( [ { x: 0, y: 0 }, { x: 1, y: 0 } ], 5 ) ).toEqual( { x: 0, y: 0 } );
		expect( calculateShift( [ { x: -1, y: 0 }, { x: -2, y: 0 } ], 5 ) ).toEqual( { x: 2, y: 0 } );
		expect( calculateShift( [ { x: 5, y: 0 }, { x: 4, y: 0 } ], 5 ) ).toEqual( { x: -1, y: 0 } );
		expect( calculateShift( [ { x: 0, y: -1 }, { x: 0, y: 0 } ], 5 ) ).toEqual( { x: 0, y: 1 } );
	} );

	test( "moves every tile the kingdom holds by the same shift", () => {
		const board = applyPlacement(
			createBoard( "red", 5 ),
			{ dominoId: 1, coord: { x: 1, y: 0 }, rotation: 0 }
		);

		const slid = getShiftedTiles( board, { x: 1, y: 0 } )!;

		expect( Object.keys( slid ).toSorted() ).toEqual( [ "1,0", "2,0", "3,0" ] );
		expect( slid[ "1,0" ] ).toEqual( { terrain: "castle", crowns: 0 } );
	} );

	test( "refuses a slide that would push a tile out of the window", () => {
		// A kingdom already five wide cannot move in x at all.
		const board = kingdom( {
			"1,0": tile( "desert" ),
			"2,0": tile( "desert" ),
			"3,0": tile( "desert" ),
			"4,0": tile( "desert" )
		} );

		expect( getShiftedTiles( board, { x: -1, y: 0 } ) ).toBeNull();
		expect( getShiftedTiles( board, { x: 0, y: 1 } ) ).not.toBeNull();
	} );
} );


describe( "the window a client draws", () => {
	test( "reads the whole window off the kingdom's size", () => {
		expect( getExactBoardBounds( createBoard( "red", 5 ) ) )
			.toEqual( { minX: 0, maxX: 4, minY: 0, maxY: 4 } );
		expect( getExactBoardBounds( createBoard( "red", 7 ) ) )
			.toEqual( { minX: 0, maxX: 6, minY: 0, maxY: 6 } );
	} );

	test( "boxes what is actually laid, origin always included", () => {
		// The castle sits at the origin until the kingdom slides, so the box is
		// seeded there rather than at the first tile it reads.
		const board = kingdom( {
			"1,0": tile( "desert" ),
			"2,0": tile( "desert" ),
			"2,1": tile( "forest" )
		} );

		expect( getBoardBounds( board ) ).toEqual( { minX: 0, maxX: 2, minY: 0, maxY: 1 } );
	} );

	test( "boxes a kingdom that reaches behind the origin too", () => {
		// A kingdom is slid back inside its window before it is stored, so this is
		// the mid-move shape rather than a stored one — the box still has to hold it.
		const board = kingdom( { "-1,0": tile( "desert" ), "0,-1": tile( "forest" ) } );

		expect( getBoardBounds( board ) ).toEqual( { minX: -1, maxX: 0, minY: -1, maxY: 0 } );
	} );

	test( "grows the box by two, but never past what the window could reach", () => {
		const board = kingdom( { "1,0": tile( "desert" ), "2,0": tile( "desert" ) } );

		// x spans three cells of the five, so it can still grow either way; the
		// clamp is what stops the drawn grid running off a 5x5's worth of window.
		expect( getExpandedBoardBounds( board ) )
			.toEqual( { minX: -2, maxX: 4, minY: -2, maxY: 2 } );
	} );

	test( "stops growing an axis the kingdom already fills", () => {
		const board = kingdom( {
			"1,0": tile( "desert" ),
			"2,0": tile( "desert" ),
			"3,0": tile( "desert" ),
			"4,0": tile( "desert" )
		} );

		const bounds = getExpandedBoardBounds( board );

		// Five wide already: nothing can be laid to the left or the right of it.
		expect( bounds.minX ).toBe( 0 );
		expect( bounds.maxX ).toBe( 4 );
		expect( bounds.minY ).toBe( -2 );
		expect( bounds.maxY ).toBe( 2 );
	} );

	test( "lays out a row and a column for every cell in the box", () => {
		const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0 };

		expect( getRowsAndCols( bounds, [] ) ).toEqual( { rows: [ 0 ], cols: [ 0, 1 ] } );
	} );

	test( "stretches the box to hold every cell a placement could reach", () => {
		const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0 };
		const cells = [ { x: -1, y: 0 }, { x: 1, y: 2 }, { x: 3, y: -1 } ];

		expect( getRowsAndCols( bounds, cells ) )
			.toEqual( { rows: [ -1, 0, 1, 2 ], cols: [ -1, 0, 1, 2, 3 ] } );
	} );

	test( "leaves the box alone for cells already inside it", () => {
		const bounds = { minX: 0, maxX: 2, minY: 0, maxY: 1 };

		expect( getRowsAndCols( bounds, [ { x: 1, y: 1 } ] ) )
			.toEqual( { rows: [ 0, 1 ], cols: [ 0, 1, 2 ] } );
	} );
} );


describe( "laying a domino", () => {
	const empty = createBoard( "red", 5 );

	test( "accepts a domino touching the castle", () => {
		expect( canDominoBePlaced( empty, { dominoId: 1, coord: { x: 1, y: 0 }, rotation: 0 } ) )
			.toBe( true );
	} );

	test( "refuses one that touches nothing", () => {
		expect( canDominoBePlaced( empty, { dominoId: 1, coord: { x: 3, y: 0 }, rotation: 0 } ) )
			.toBe( false );
	} );

	test( "refuses one that would overlap what is already there", () => {
		expect( canDominoBePlaced( empty, { dominoId: 1, coord: { x: 0, y: 0 }, rotation: 0 } ) )
			.toBe( false );
	} );

	test( "refuses a number the box does not hold", () => {
		// An id outside the deck has no terrain to connect, so it can never be a
		// legal adjacency — which is what turns a bad id into a rejected move
		// rather than a TypeError inside the reducer.
		const unknown = KINGDOMINO_DECK_SIZE + 1;

		expect( canDominoBePlaced( empty, { dominoId: unknown, coord: { x: 1, y: 0 }, rotation: 0 } ) )
			.toBe( false );
		expect( getValidPlacements( empty, unknown ) ).toEqual( [] );
	} );

	test( "requires matching terrain once the castle is walled in", () => {
		const board = kingdom( { "1,0": tile( "desert" ), "2,0": tile( "desert" ) } );

		// Domino 3 is forest/forest: it can still reach the castle, but not the
		// desert the castle's neighbour became.
		expect( canDominoBePlaced( board, { dominoId: 3, coord: { x: 3, y: 0 }, rotation: 0 } ) )
			.toBe( false );
		expect( canDominoBePlaced( board, { dominoId: 3, coord: { x: 0, y: 1 }, rotation: 90 } ) )
			.toBe( true );
	} );

	test( "holds every kingdom inside its own size", () => {
		const board = kingdom( {
			"1,0": tile( "desert" ),
			"2,0": tile( "desert" ),
			"3,0": tile( "desert" ),
			"4,0": tile( "desert" )
		} );

		// Legal on its own terms — desert next to desert — but the kingdom would
		// have to slide, and it is already the full five wide.
		expect( canDominoBePlaced( board, { dominoId: 1, coord: { x: 5, y: 0 }, rotation: 0 } ) )
			.toBe( false );
	} );

	test( "counts an orientation whose second half is the one that connects", () => {
		// Domino 13 is desert/forest. Anchored two cells out and turned back on
		// itself, its forest half lands beside the castle and its desert half sits
		// where nothing touches it — a legal placement whose anchor connects to
		// nothing, and a different move from the mirrored one.
		const placement = { dominoId: 13, coord: { x: 2, y: 0 }, rotation: 180 } as const;

		expect( canDominoBePlaced( empty, placement ) ).toBe( true );
		expect( getValidPlacements( empty, 13 ) ).toContainEqual( placement );
	} );

	test( "offers each placement once", () => {
		const placements = getValidPlacements( empty, 13 );
		const keys = placements.map( p => `${ coordKey( p.coord ) }:${ p.rotation }` );

		expect( new Set( keys ).size ).toBe( placements.length );
		expect( placements.every( p => canDominoBePlaced( empty, p ) ) ).toBe( true );
	} );

	test( "offers nothing once the kingdom is full — which is what allows a discard", () => {
		const filled: Board = {
			size: 5,
			castle: "red",
			placements: [],
			tiles: Object.fromEntries( Array.from( { length: 25 }, ( _, i ) => [
				coordKey( { x: i % 5, y: Math.floor( i / 5 ) } ),
				i === 0 ? tile( "castle" ) : tile( "desert" )
			] ) )
		};

		// Every cell of the window is taken, and nothing outside it can be reached
		// without sliding a tile out.
		expect( getValidPlacements( filled, 1 ) ).toEqual( [] );
	} );

	test( "offers nothing for a domino nothing on the board will join", () => {
		// A 5x5 kingdom with one two-cell gap left in the corner, walled in by
		// desert on every side.
		const gapped: Board = {
			size: 5,
			castle: "red",
			placements: [],
			tiles: Object.fromEntries( Array.from( { length: 25 }, ( _, i ) => [
				coordKey( { x: i % 5, y: Math.floor( i / 5 ) } ),
				i === 0 ? tile( "castle" ) : tile( "desert" )
			] ).filter( ( [ key ] ) => key !== "4,4" && key !== "3,4" ) )
		};

		// The gap takes a desert domino, so the kingdom is not simply out of room —
		// a forest one has nothing there to join.
		expect( getValidPlacements( gapped, 1 ).length ).toBeGreaterThan( 0 );
		expect( getValidPlacements( gapped, 3 ) ).toEqual( [] );
	} );

	test( "lands both halves and records where they ended up", () => {
		const placed = applyPlacement( empty, { dominoId: 13, coord: { x: 1, y: 0 }, rotation: 0 } );

		expect( placed.tiles[ "1,0" ] ).toEqual( getDomino( 13 )!.left );
		expect( placed.tiles[ "2,0" ] ).toEqual( getDomino( 13 )!.right );
		expect( placed.placements ).toEqual( [ { dominoId: 13, coord: { x: 1, y: 0 }, rotation: 0 } ] );

		// A new kingdom every time — the one it was laid on is untouched.
		expect( empty.tiles[ "1,0" ] ).toBeUndefined();
		expect( empty.placements ).toEqual( [] );
	} );

	test( "lays the domino where it was told to, sliding nothing", () => {
		// The slide is the move's decision, not the reducer's: `execute` works the
		// shift out with `calculateShift`, slides with `getShiftedTiles`, and hands
		// this the coordinates the domino ended up at.
		const placed = applyPlacement( empty, { dominoId: 13, coord: { x: -1, y: 0 }, rotation: 180 } );

		expect( placed.tiles[ "-1,0" ] ).toEqual( getDomino( 13 )!.left );
		expect( placed.tiles[ "-2,0" ] ).toEqual( getDomino( 13 )!.right );
		expect( placed.tiles[ "0,0" ] ).toEqual( { terrain: "castle", crowns: 0 } );
	} );

	test( "leaves the kingdom alone for a number the box does not hold", () => {
		const placement = {
			dominoId: KINGDOMINO_DECK_SIZE + 1,
			coord: { x: 1, y: 0 },
			rotation: 0
		} as const;

		// Validation already refuses this, so reaching here means it was bypassed —
		// a no-op keeps a bad move harmless instead of throwing inside `execute`.
		expect( applyPlacement( empty, placement ) ).toBe( empty );
	} );
} );


describe( "the cells a client offers", () => {
	const empty = createBoard( "red", 5 );

	test( "offers the empty cells touching something already laid", () => {
		const cells = new Set( getCandidateCells( empty ).map( coordKey ) );

		expect( cells ).toEqual( new Set( [ "1,0", "0,1", "-1,0", "0,-1" ] ) );
	} );

	test( "leaves out a cell of the kingdom that is already taken", () => {
		const board = kingdom( { "1,0": tile( "desert" ) } );
		const cells = new Set( getCandidateCells( board ).map( coordKey ) );

		expect( cells.has( "0,0" ) ).toBe( false );
		expect( cells.has( "1,0" ) ).toBe( false );
		expect( cells.has( "2,0" ) ).toBe( true );
	} );

	test( "turns the four rotations of a cell into the ones that are legal there", () => {
		// Anchored beside the castle, only the turn back onto it is refused: the
		// other three are free cells the kingdom can be slid to hold.
		expect( getValidRotations( empty, 1, { x: 1, y: 0 } ) ).toEqual( [ 0, 90, 270 ] );

		// Two cells out, nothing the domino could join is in reach.
		expect( getValidRotations( empty, 1, { x: 3, y: 0 } ) ).toEqual( [] );
	} );

	test( "reads its rotations out of the four a domino has", () => {
		expect( ALL_ROTATIONS ).toEqual( [ 0, 90, 180, 270 ] );
		expect( getValidRotations( empty, 1, { x: 1, y: 0 } )
			.every( rotation => ALL_ROTATIONS.includes( rotation ) ) ).toBe( true );
	} );

	test( "shades every free cell some domino could still take", () => {
		const cells = getPotentialCells( empty ).map( coordKey );

		// Both halves of a domino laid beside the castle, and nothing that is
		// already occupied — this is a highlight, not a placement.
		expect( cells ).toContain( "1,0" );
		expect( cells ).toContain( "2,0" );
		expect( cells ).not.toContain( "0,0" );
		expect( new Set( cells ).size ).toBe( cells.length );
	} );

	test( "shades nothing once the kingdom is full", () => {
		const filled: Board = {
			size: 5,
			castle: "red",
			placements: [],
			tiles: Object.fromEntries( Array.from( { length: 25 }, ( _, i ) => [
				coordKey( { x: i % 5, y: Math.floor( i / 5 ) } ),
				i === 0 ? tile( "castle" ) : tile( "desert" )
			] ) )
		};

		expect( getPotentialCells( filled ) ).toEqual( [] );
		expect( getPotentialCellsForDomino( filled, 1 ) ).toEqual( [] );
	} );

	test( "narrows the shading to what one domino's terrain can join", () => {
		// A 5x5 kingdom walled in desert, with a two-cell gap in the corner.
		const gapped: Board = {
			size: 5,
			castle: "red",
			placements: [],
			tiles: Object.fromEntries( Array.from( { length: 25 }, ( _, i ) => [
				coordKey( { x: i % 5, y: Math.floor( i / 5 ) } ),
				i === 0 ? tile( "castle" ) : tile( "desert" )
			] ).filter( ( [ key ] ) => key !== "4,4" && key !== "3,4" ) )
		};

		// Domino 1 is desert/desert and the gap is walled in desert; domino 3 is
		// forest/forest, and there is no forest anywhere to join.
		expect( getPotentialCellsForDomino( gapped, 1 ).map( coordKey ) ).toContain( "3,4" );
		expect( getPotentialCellsForDomino( gapped, 3 ) ).toEqual( [] );
	} );
} );


describe( "scoring a kingdom", () => {
	test( "pays a territory its tiles times its crowns", () => {
		const score = calculateScore( kingdom( {
			"1,0": tile( "forest", 1 ),
			"2,0": tile( "forest" ),
			"3,0": tile( "forest" )
		} ) );

		expect( score.points ).toBe( 3 );
		expect( score.regions ).toHaveLength( 1 );
		expect( score.regions[ 0 ] ).toMatchObject( { tiles: 3, crowns: 1, points: 3 } );
	} );

	test( "pays an uncrowned territory nothing, however big", () => {
		const score = calculateScore( kingdom( {
			"1,0": tile( "water" ),
			"2,0": tile( "water" ),
			"3,0": tile( "water" ),
			"4,0": tile( "water" )
		} ) );

		expect( score.points ).toBe( 0 );
		expect( score.regions[ 0 ] ).toMatchObject( { tiles: 4, crowns: 0 } );
	} );

	test( "keeps two runs of one terrain apart when nothing joins them", () => {
		const score = calculateScore( kingdom( {
			"1,0": tile( "forest", 1 ),
			"2,0": tile( "water" ),
			"3,0": tile( "forest", 1 )
		} ) );

		const forests = score.regions.filter( region => region.terrain === "forest" );

		expect( forests ).toHaveLength( 2 );
		expect( score.points ).toBe( 2 );
	} );

	test( "joins a territory around a corner", () => {
		const score = calculateScore( kingdom( {
			"1,0": tile( "mine", 3 ),
			"1,1": tile( "mine" ),
			"2,1": tile( "mine" )
		} ) );

		expect( score.regions ).toHaveLength( 1 );
		expect( score.points ).toBe( 9 );
	} );

	test( "leaves the castle out of every territory", () => {
		const score = calculateScore( kingdom( { "1,0": tile( "forest", 1 ) } ) );

		expect( score.regions ).toHaveLength( 1 );
		expect( score.regions[ 0 ]!.tiles ).toBe( 1 );
		expect( score.points ).toBe( 1 );
	} );
} );


describe( "drafting a row", () => {
	test( "gives a duel two picks a round and everyone else one", () => {
		expect( getSelectionsPerPlayer( 2 ) ).toBe( 2 );
		expect( getSelectionsPerPlayer( 3 ) ).toBe( 1 );
		expect( getSelectionsPerPlayer( 4 ) ).toBe( 1 );
	} );

	test( "turns up four whatever the seat count, so a table of three leaves one", () => {
		for ( const playerCount of KINGDOMINO_PLAYER_COUNTS ) {
			const claims = playerCount * getSelectionsPerPlayer( playerCount );

			expect( claims ).toBeLessThanOrEqual( KINGDOMINO_DRAFT_SIZE );
			expect( KINGDOMINO_DRAFT_SIZE - claims ).toBe( playerCount === 3 ? 1 : 0 );
		}
	} );

	test( "spends the whole box in equal rows", () => {
		expect( KINGDOMINO_DECK_SIZE % KINGDOMINO_DRAFT_SIZE ).toBe( 0 );
	} );

	test( "hands a table of three or four exactly the kingdom a 5x5 holds", () => {
		const rounds = KINGDOMINO_DECK_SIZE / KINGDOMINO_DRAFT_SIZE;

		for ( const playerCount of [ 3, 4 ] as const ) {
			const perPlayer = rounds * getSelectionsPerPlayer( playerCount );
			expect( ( perPlayer * 2 ) + 1 ).toBe( 25 );
		}
	} );

	test( "hands a duel a 7x7's worth, which is twice what a 5x5 holds", () => {
		const rounds = KINGDOMINO_DECK_SIZE / KINGDOMINO_DRAFT_SIZE;
		const perPlayer = rounds * getSelectionsPerPlayer( 2 );

		// Two picks a round for twelve rounds fills the 7x7 duel exactly. On the
		// 5x5 it is twice the kingdom, so half of a duel's dominoes are discarded
		// rather than laid — the board fills and `discardDomino` takes the rest.
		expect( perPlayer ).toBe( 24 );
		expect( ( perPlayer * 2 ) + 1 ).toBe( 49 );
	} );

	test( "turns the row face up in order, off the front of the deck", () => {
		const deck = [ 9, 3, 20, 1, 44 ].map( id => getDomino( id )! );
		const { draft, deck: rest } = drawDraft( deck );

		expect( draft.map( entry => entry.domino.id ) ).toEqual( [ 1, 3, 9, 20 ] );
		expect( draft.every( entry => !( "selectedBy" in entry ) ) ).toBe( true );

		// Pure: what was drawn comes off the deck it was handed, and the deck it
		// was handed is left alone — the reducer stores the remainder.
		expect( rest.map( domino => domino.id ) ).toEqual( [ 44 ] );
		expect( deck ).toHaveLength( 5 );
	} );

	test( "turns up whatever is left when the box runs short", () => {
		const deck = [ 9, 3 ].map( id => getDomino( id )! );
		const { draft, deck: rest } = drawDraft( deck );

		expect( draft.map( entry => entry.domino.id ) ).toEqual( [ 3, 9 ] );
		expect( rest ).toEqual( [] );
	} );

	test( "counts a seat's claims in the row on offer", () => {
		const row = [ claimed( 1, a ), claimed( 2, b ), claimed( 3, a ), claimed( 4 ) ];

		expect( getPlayerSelectionCount( row, a ) ).toBe( 2 );
		expect( getPlayerSelectionCount( row, b ) ).toBe( 1 );
		expect( getPlayerSelectionCount( row, c ) ).toBe( 0 );
	} );
} );


describe( "playing a row out", () => {
	const row = [ claimed( 3, b ), claimed( 7, a ), claimed( 12, b ), claimed( 30, a ) ];

	test( "orders the claimants by the number they took", () => {
		expect( draftPlayerOrder( row ) ).toEqual( [ b, a, b, a ] );
	} );

	test( "ignores a domino nobody claimed", () => {
		expect( draftPlayerOrder( [ claimed( 3, b ), claimed( 7 ) ] ) ).toEqual( [ b ] );
	} );

	test( "gives a seat one slot per domino it took", () => {
		// The order is a slot list rather than a seat list, which is what lets the
		// PLACE phase walk it — each seat lays as many as it claimed. Whose turn it
		// is inside the phase is the engine's to resolve against the seats' queues.
		expect( draftPlayerOrder( row ).filter( id => id === a ) ).toHaveLength( 2 );
		expect( draftPlayerOrder( row ).filter( id => id === b ) ).toHaveLength( 2 );
		expect( draftPlayerOrder( [] ) ).toEqual( [] );
	} );
} );


describe( "the final table", () => {
	test( "reads the largest property and the crowns off the regions", () => {
		const score = seat( [ { tiles: 5, crowns: 1 }, { tiles: 2, crowns: 3 } ] ).score;

		expect( largestProperty( score ) ).toBe( 5 );
		expect( totalCrowns( score ) ).toBe( 4 );
		expect( largestProperty( undefined ) ).toBe( 0 );
		expect( totalCrowns( undefined ) ).toBe( 0 );
	} );

	test( "ranks on points first", () => {
		const data = {
			[ a ]: seat( [ { tiles: 2, crowns: 1 } ] ),
			[ b ]: seat( [ { tiles: 5, crowns: 2 } ] )
		} as KingdominoState[ "playerData" ];

		expect( rankPlayers( [ a, b ], data ) ).toEqual( [ b, a ] );
		expect( decideWinner( [ a, b ], data ) ).toBe( b );
	} );

	test( "breaks a tie on points with the largest property", () => {
		const data = {
			// Both worth six, but b's points come out of one big territory.
			[ a ]: seat( [ { tiles: 2, crowns: 1 }, { tiles: 2, crowns: 2 } ] ),
			[ b ]: seat( [ { tiles: 6, crowns: 1 } ] )
		} as KingdominoState[ "playerData" ];

		expect( compareStandings( data[ b ], data[ a ] ) ).toBeLessThan( 0 );
		expect( decideWinner( [ a, b ], data ) ).toBe( b );
	} );

	test( "breaks a tie on the largest property with the crowns", () => {
		const data = {
			[ a ]: seat( [ { tiles: 4, crowns: 1 }, { tiles: 1, crowns: 0 } ] ),
			[ b ]: seat( [ { tiles: 4, crowns: 1 }, { tiles: 2, crowns: 0 } ] ),
			[ c ]: seat( [ { tiles: 2, crowns: 2 }, { tiles: 4, crowns: 0 } ] )
		} as KingdominoState[ "playerData" ];

		// a and c are level on points and largest property; c holds more crowns.
		expect( compareStandings( data[ c ], data[ a ] ) ).toBeLessThan( 0 );
		expect( compareStandings( data[ a ], data[ b ] ) ).toBe( 0 );
	} );

	test( "shares the victory when the top two are level on everything", () => {
		const data = {
			[ a ]: seat( [ { tiles: 3, crowns: 2 } ] ),
			[ b ]: seat( [ { tiles: 3, crowns: 2 } ] )
		} as KingdominoState[ "playerData" ];

		expect( decideWinner( [ a, b ], data ) ).toBeUndefined();
		expect( standingsFor( [ a, b ], data ).ranking.map( s => s.rank ) ).toEqual( [ 1, 1 ] );
		expect( standingsFor( [ a, b ], data ).winner ).toBeUndefined();
	} );

	test( "skips the place a shared rank used up", () => {
		const data = {
			[ a ]: seat( [ { tiles: 3, crowns: 2 } ] ),
			[ b ]: seat( [ { tiles: 3, crowns: 2 } ] ),
			[ c ]: seat( [ { tiles: 1, crowns: 1 } ] )
		} as KingdominoState[ "playerData" ];

		const { ranking } = standingsFor( [ a, b, c ], data );

		expect( ranking.map( standing => standing.rank ) ).toEqual( [ 1, 1, 3 ] );
		expect( ranking.map( standing => standing.score ) ).toEqual( [ 6, 6, 1 ] );
	} );
} );
