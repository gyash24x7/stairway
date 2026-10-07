import { assert, describe, it } from "@effect/vitest";

import type {
	Board,
	Castle,
	DraftEntry,
	KingdominoState,
	Placement
} from "@/games/kingdomino/schema";
import { KINGDOMINO_DECK_SIZE, KINGDOMINO_DRAFT_SIZE } from "@/games/kingdomino/schema";
import {
	calculateScore,
	canDominoBePlaced,
	claimsMade,
	claimsOwed,
	coordKey,
	createBoard,
	DOMINO_DECK,
	dominoesHeld,
	draftPlayerOrder,
	drawDraft,
	getDomino,
	getPlacementCoordinates,
	getPlayerSelectionCount,
	getSelectionsPerPlayer,
	getValidPlacements,
	getValidRotations,
	largestProperty,
	layDomino,
	nextInQueue,
	parseCoordKey,
	seatAt,
	standingsFor,
	totalCrowns
} from "@/games/kingdomino/utils";
import type { PlayerId } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;
const carol = "carol" as PlayerId;

/** A fresh kingdom with only the castle on it. */
const kingdom = ( castle: Castle = "red", size: 5 | 7 = 5 ) =>
	createBoard( castle, size ) as Board;

const state = ( overrides: Partial<KingdominoState> = {} ): KingdominoState => ( {
	playerData: {},
	deck: [],
	draft: [],
	selectionOrder: [],
	...overrides
} );

const entry = ( id: number, selectedBy?: PlayerId ): DraftEntry => ( {
	domino: getDomino( id )!,
	selectedBy
} );

const seat = ( queue: ReadonlyArray<number> ) => ( {
	board: kingdom(),
	queue,
	score: { regions: [], points: 0 }
} );


describe( "kingdomino utils", () => {

	describe( "the box", () => {

		it( "holds forty-eight dominoes, numbered densely from one", () => {
			assert.strictEqual( DOMINO_DECK.length, KINGDOMINO_DECK_SIZE );
			assert.deepStrictEqual(
				DOMINO_DECK.map( domino => domino.id ),
				Array.from( { length: KINGDOMINO_DECK_SIZE }, ( _, i ) => i + 1 )
			);
		} );

		it( "looks a domino up by its printed number", () => {
			assert.strictEqual( getDomino( 1 )?.id, 1 );
			assert.strictEqual( getDomino( KINGDOMINO_DECK_SIZE )?.id, KINGDOMINO_DECK_SIZE );
		} );

		it( "never carries a crown on both halves of a low domino", () => {
			// The box is printed so that crowns arrive with the higher numbers.
			const crowned = DOMINO_DECK.filter(
				domino => domino.left.crowns + domino.right.crowns > 0
			);

			assert.isAbove( crowned.length, 0 );
			assert.isBelow( crowned.length, KINGDOMINO_DECK_SIZE );
		} );
	} );

	describe( "coordinates", () => {

		it( "round-trips through its key", () => {
			assert.strictEqual( coordKey( { x: 2, y: -1 } ), "2,-1" );
			assert.deepStrictEqual( parseCoordKey( "2,-1" ), { x: 2, y: -1 } );
		} );

		it( "lays the second half in the direction the rotation names", () => {
			const at = { coord: { x: 0, y: 0 } };

			assert.deepStrictEqual(
				getPlacementCoordinates( { ...at, rotation: 0 } ).map( coordKey ),
				[ "0,0", coordKey( getPlacementCoordinates( { ...at, rotation: 0 } )[ 1 ] ) ]
			);

			// The four rotations give four distinct neighbours.
			const seconds = new Set(
				( [ 0, 90, 180, 270 ] as const ).map(
					rotation => coordKey( getPlacementCoordinates( { ...at, rotation } )[ 1 ] )
				)
			);

			assert.strictEqual( seconds.size, 4 );
		} );

		it( "always puts the first half at the anchor", () => {
			for ( const rotation of [ 0, 90, 180, 270 ] as const ) {
				const [ first ] = getPlacementCoordinates( { coord: { x: 3, y: 2 }, rotation } );
				assert.deepStrictEqual( first, { x: 3, y: 2 } );
			}
		} );
	} );

	describe( "createBoard", () => {

		it( "starts with a castle at the origin and nothing else", () => {
			const board = kingdom( "blue" );

			assert.strictEqual( board.castle, "blue" );
			assert.strictEqual( board.size, 5 );
			assert.deepStrictEqual( board.placements, [] );
			assert.deepStrictEqual( board.tiles, { "0,0": { terrain: "castle", crowns: 0 } } );
		} );
	} );

	describe( "canDominoBePlaced", () => {

		it( "accepts a domino touching the castle, whatever its terrain", () => {
			// The castle connects to anything — that is what gets a kingdom started.
			const placements = getValidPlacements( kingdom(), 1 );
			assert.isAbove( placements.length, 0 );

			for ( const placement of placements ) {
				assert.isTrue( canDominoBePlaced( kingdom(), placement ) );
			}
		} );

		it( "refuses a domino touching nothing at all", () => {
			const board = kingdom();
			const far: Placement = { dominoId: 1, coord: { x: 4, y: 4 }, rotation: 0 };

			assert.isFalse( canDominoBePlaced( board, far ) );
		} );

		it( "refuses a domino overlapping the castle", () => {
			const onTop: Placement = { dominoId: 1, coord: { x: 0, y: 0 }, rotation: 0 };
			assert.isFalse( canDominoBePlaced( kingdom(), onTop ) );
		} );

		it( "offers only the rotations that actually fit", () => {
			const rotations = getValidRotations( kingdom(), 1, { x: 1, y: 0 } );

			assert.isAbove( rotations.length, 0 );
			for ( const rotation of rotations ) {
				assert.isTrue( canDominoBePlaced(
					kingdom(),
					{ dominoId: 1, coord: { x: 1, y: 0 }, rotation }
				) );
			}
		} );

		it( "keeps a five-by-five kingdom inside a five-by-five window", () => {
			// A kingdom is a window over a plane, so a placement is legal when the
			// board can slide under it — but never when the result would not fit.
			const board = kingdom();
			const laid = layDomino( board, getValidPlacements( board, 1 )[ 0 ]! );

			const xs = Object.keys( laid.tiles ).map( key => parseCoordKey( key ).x );
			const ys = Object.keys( laid.tiles ).map( key => parseCoordKey( key ).y );

			assert.isAtMost( Math.max( ...xs ) - Math.min( ...xs ), 4 );
			assert.isAtMost( Math.max( ...ys ) - Math.min( ...ys ), 4 );
		} );
	} );

	describe( "layDomino", () => {

		it( "writes both halves and records the placement", () => {
			const board = kingdom();
			const placement = getValidPlacements( board, 1 )[ 0 ]!;
			const laid = layDomino( board, placement );

			assert.strictEqual( Object.keys( laid.tiles ).length, 3 );
			assert.strictEqual( laid.placements.length, 1 );
		} );

		it( "keeps the stored placements in step with the tiles", () => {
			// The board slides when a placement hangs off an edge, and the stored
			// placements slide with it — a client renders either and gets the same
			// kingdom.
			let board = kingdom();

			for ( const id of [ 1, 2, 3, 4 ] ) {
				const options = getValidPlacements( board, id );
				if ( options.length === 0 ) {
					break;
				}

				board = layDomino( board, options[ 0 ]! );
			}

			for ( const placement of board.placements ) {
				for ( const coord of getPlacementCoordinates( placement ) ) {
					assert.isDefined( board.tiles[ coordKey( coord ) ], coordKey( coord ) );
				}
			}
		} );

		it( "slides the kingdom under a placement that hangs off an edge", () => {
			// A kingdom is a window over a plane: the castle starts at the origin and
			// the window travels, which is why a placement at a negative coordinate
			// is legal at all.
			const board = kingdom();
			const hanging = getValidPlacements( board, 1 ).find(
				placement => placement.coord.x < 0 || placement.coord.y < 0
			)!;

			assert.isDefined( hanging, "a fresh kingdom accepts a negative anchor" );
			assert.isTrue( canDominoBePlaced( board, hanging ) );

			const laid = layDomino( board, hanging );
			const xs = Object.keys( laid.tiles ).map( key => parseCoordKey( key ).x );
			const ys = Object.keys( laid.tiles ).map( key => parseCoordKey( key ).y );

			// Everything ends up inside the window, castle included.
			assert.isAtLeast( Math.min( ...xs ), 0 );
			assert.isAtLeast( Math.min( ...ys ), 0 );
			assert.isBelow( Math.max( ...xs ), board.size );
			assert.isBelow( Math.max( ...ys ), board.size );
			assert.strictEqual( Object.keys( laid.tiles ).length, 3 );
		} );
	} );

	describe( "calculateScore", () => {

		it( "scores an empty kingdom at nothing", () => {
			assert.deepStrictEqual( calculateScore( kingdom() ), { regions: [], points: 0 } );
		} );

		it( "pays a region its size times its crowns", () => {
			const board: Board = {
				...kingdom(),
				tiles: {
					"0,0": { terrain: "castle", crowns: 0 },
					"1,0": { terrain: "forest", crowns: 1 },
					"2,0": { terrain: "forest", crowns: 0 },
					"3,0": { terrain: "forest", crowns: 1 }
				}
			};

			const score = calculateScore( board );
			const forest = score.regions.find( region => region.terrain === "forest" )!;

			assert.strictEqual( forest.tiles, 3 );
			assert.strictEqual( forest.crowns, 2 );
			assert.strictEqual( forest.points, 6 );
			assert.strictEqual( score.points, 6 );
		} );

		it( "pays an uncrowned region nothing, however large", () => {
			const board: Board = {
				...kingdom(),
				tiles: {
					"0,0": { terrain: "castle", crowns: 0 },
					"1,0": { terrain: "water", crowns: 0 },
					"2,0": { terrain: "water", crowns: 0 },
					"3,0": { terrain: "water", crowns: 0 }
				}
			};

			const score = calculateScore( board );
			assert.strictEqual( score.points, 0 );
			assert.strictEqual( score.regions[ 0 ]?.tiles, 3 );
		} );

		it( "keeps two runs of one terrain apart when they do not touch", () => {
			const board: Board = {
				...kingdom(),
				tiles: {
					"0,0": { terrain: "castle", crowns: 0 },
					"1,0": { terrain: "forest", crowns: 1 },
					"3,0": { terrain: "forest", crowns: 1 },
					"4,0": { terrain: "forest", crowns: 0 }
				}
			};

			const score = calculateScore( board );
			const forests = score.regions.filter( region => region.terrain === "forest" );

			assert.strictEqual( forests.length, 2 );
			assert.strictEqual( score.points, 1 + 2 );
		} );

		it( "never counts the castle as a region", () => {
			const board: Board = {
				...kingdom(),
				tiles: {
					"0,0": { terrain: "castle", crowns: 0 },
					"1,0": { terrain: "forest", crowns: 1 }
				}
			};

			assert.isUndefined(
				calculateScore( board ).regions.find( region => region.terrain === "castle" )
			);
		} );
	} );

	describe( "the tie-breaks", () => {

		const scored = ( points: number, tiles: number, crowns: number ) => ( {
			board: kingdom(),
			queue: [],
			score: {
				points,
				regions: [ { id: "r", terrain: "forest" as const, tiles, placement: [], crowns, points } ]
			}
		} );

		it( "reads the largest single property off the regions", () => {
			assert.strictEqual( largestProperty( scored( 6, 3, 2 ).score ), 3 );
			assert.strictEqual( largestProperty( undefined ), 0 );
		} );

		it( "counts every crown in the kingdom", () => {
			assert.strictEqual( totalCrowns( scored( 6, 3, 2 ).score ), 2 );
			assert.strictEqual( totalCrowns( undefined ), 0 );
		} );

		it( "ranks on points first", () => {
			const { ranking, winner } = standingsFor( [ alice, bob ], {
				[ alice ]: scored( 10, 2, 5 ),
				[ bob ]: scored( 12, 1, 1 )
			} );

			assert.strictEqual( winner, bob );
			assert.deepStrictEqual(
				ranking.map( s => [ s.playerId, s.rank ] ),
				[ [ bob, 1 ], [ alice, 2 ] ]
			);
		} );

		it( "breaks a tie on the largest property", () => {
			const { winner } = standingsFor( [ alice, bob ], {
				[ alice ]: scored( 10, 5, 2 ),
				[ bob ]: scored( 10, 2, 5 )
			} );

			assert.strictEqual( winner, alice );
		} );

		it( "breaks a deeper tie on crowns", () => {
			const { winner } = standingsFor( [ alice, bob ], {
				[ alice ]: scored( 10, 5, 2 ),
				[ bob ]: scored( 10, 5, 3 )
			} );

			assert.strictEqual( winner, bob );
		} );

		it( "names no winner when three seats are level all the way down", () => {
			// A shared victory is a result, not a tie to be broken by seating order.
			const level = scored( 10, 5, 2 );
			const { ranking, winner } = standingsFor( [ alice, bob, carol ], {
				[ alice ]: level,
				[ bob ]: level,
				[ carol ]: level
			} );

			assert.isUndefined( winner );
			assert.deepStrictEqual( ranking.map( s => s.rank ), [ 1, 1, 1 ] );
		} );
	} );

	describe( "the draft", () => {

		it( "turns four face up, lowest id first", () => {
			const deck = [ ...DOMINO_DECK ].reverse();
			const { draft, deck: rest } = drawDraft( deck );

			assert.strictEqual( draft.length, KINGDOMINO_DRAFT_SIZE );
			assert.deepStrictEqual(
				draft.map( item => item.domino.id ),
				draft.map( item => item.domino.id ).sort( ( a, b ) => a - b )
			);
			assert.strictEqual( rest.length, deck.length - KINGDOMINO_DRAFT_SIZE );
		} );

		it( "draws what is left when the deck is short", () => {
			const { draft, deck } = drawDraft( DOMINO_DECK.slice( 0, 2 ) );
			assert.strictEqual( draft.length, 2 );
			assert.strictEqual( deck.length, 0 );
		} );

		it( "gives a table of two a king each way, and a bigger table one", () => {
			assert.strictEqual( getSelectionsPerPlayer( 2 ), 2 );
			assert.strictEqual( getSelectionsPerPlayer( 3 ), 1 );
			assert.strictEqual( getSelectionsPerPlayer( 4 ), 1 );
		} );

		it( "counts a seat's claims against the row", () => {
			const draft = [ entry( 1, alice ), entry( 2, bob ), entry( 3, alice ), entry( 4 ) ];
			assert.strictEqual( getPlayerSelectionCount( draft, alice ), 2 );
			assert.strictEqual( getPlayerSelectionCount( draft, carol ), 0 );
		} );

		it( "owes one claim per slot, not per domino", () => {
			// Three seats leave the fourth domino unclaimed, and it is pruned.
			const table = state( {
				draft: [ entry( 1 ), entry( 2 ), entry( 3 ), entry( 4 ) ],
				selectionOrder: [ alice, bob, carol ]
			} );

			assert.strictEqual( claimsOwed( table ), 3 );
			assert.strictEqual( claimsMade( table ), 0 );
		} );

		it( "reads the next order off the claims, lowest domino first", () => {
			// Claiming a weak, low domino to buy an early pick is the only real
			// decision the game offers, and this is where it is paid out.
			const draft = [ entry( 12, alice ), entry( 3, carol ), entry( 30, bob ), entry( 40 ) ];
			assert.deepStrictEqual( draftPlayerOrder( draft ), [ carol, alice, bob ] );
		} );

		it( "gives a table of two four slots, two per seat", () => {
			const draft = [
				entry( 5, alice ), entry( 9, bob ), entry( 20, bob ), entry( 31, alice )
			];

			assert.deepStrictEqual( draftPlayerOrder( draft ), [ alice, bob, bob, alice ] );
		} );

		it( "leaves an unclaimed domino out of the next order", () => {
			assert.deepStrictEqual(
				draftPlayerOrder( [ entry( 1, alice ), entry( 2 ) ] ),
				[ alice ]
			);
		} );
	} );

	describe( "reading the table", () => {

		it( "counts every domino claimed but not yet laid", () => {
			const table = state( {
				playerData: { [ alice ]: seat( [ 4, 9 ] ), [ bob ]: seat( [] ) }
			} );

			assert.strictEqual( dominoesHeld( table ), 2 );
		} );

		it( "makes a seat lay its lowest claim first", () => {
			// At a table of two a seat holds both claims at once, and the kings are
			// placed in id order — so the seat is not free to reorder its own round.
			assert.strictEqual( nextInQueue( seat( [ 30, 12 ] ) ), 12 );
			assert.isUndefined( nextInQueue( seat( [] ) ) );
			assert.isUndefined( nextInQueue( undefined ) );
		} );

		it( "wraps the slot index rather than running off the end", () => {
			// The cursor is asked for the next seat before the phase is asked whether
			// it has finished, so the last slot of a round would otherwise name nobody.
			const table = state( { selectionOrder: [ alice, bob ] } );

			assert.strictEqual( seatAt( table, 0, carol ), alice );
			assert.strictEqual( seatAt( table, 1, carol ), bob );
			assert.strictEqual( seatAt( table, 2, carol ), alice );
		} );

		it( "falls back when there is no order yet", () => {
			assert.strictEqual( seatAt( state(), 0, carol ), carol );
		} );
	} );
} );
