import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import {
	BaseGameConfig,
	InitializeInput,
	PlayerId,
	PositiveInt,
	SeatView
} from "@/swish/shared/schema.ts";


// --- Constants ------------------------------------------------------

/**
 * Kingdomino seats 2-4: there are exactly four castle colours (`CASTLES`), and
 * the draft rhythm is derived from the count (`getSelectionsPerPlayer`). A fifth
 * seat would index past the castle list.
 */
export const KINGDOMINO_PLAYER_COUNTS = [ 2, 3, 4 ] as const;

/** The kingdoms a table can be played on: the printed 5x5, or the duel's 7x7. */
export const KINGDOMINO_BOARD_SIZES = [ 5, 7 ] as const;

/** The printed kingdom, and what a table is laid out on unless a duel says otherwise. */
export const KINGDOMINO_DEFAULT_BOARD_SIZE = 5;

/** How many dominoes the box holds. Every table plays with all of them. */
export const KINGDOMINO_DECK_SIZE = 48;

/**
 * How many dominoes a row turns face up — always four, whatever the seat count.
 * A table of three claims only three of them, and the one nobody wanted is
 * pruned as the round closes: it is out of the game rather than shuffled back,
 * which is what keeps the deck a fixed number of equal rows.
 */
export const KINGDOMINO_DRAFT_SIZE = 4;

/**
 * The most crowns one half of a domino carries — the box tops out at the single
 * three-crown mine. Bounds `Tile.crowns` so a stored tile can never claim more.
 */
export const KINGDOMINO_MAX_CROWNS = 3;

/**
 * How far outside the kingdom a placement's anchor may sit before the board is
 * slid back under it. Placed tiles always live inside `[ 0, size - 1 ]`, and a
 * legal domino touches one of them, so its anchor reaches at most two cells past
 * that window on either side — which is what bounds `Coord` at the decode
 * boundary instead of leaving a wild coordinate to `validate`.
 */
export const KINGDOMINO_COORD_SLACK = 2;

/**
 * How long a seat may hold its turn. An expired clock hands the seat to
 * `botMove` and leaves it there until its player takes it back, so a player who
 * walks away is played for rather than stalling the draft for everyone else.
 */
export const KINGDOMINO_MOVE_TIMEOUT_MILLIS = 120_000;


// --- Primitives ------------------------------------------------------

export type Terrain = typeof Terrain.Type;
export const Terrain = Schema.Literals( [
	"castle",
	"desert",
	"forest",
	"water",
	"grassland",
	"wasteland",
	"mine"
] );

export type Tile = typeof Tile.Type;
export const Tile = Schema.Struct( {
	terrain: Terrain,
	crowns: Schema.Int.check(
		Schema.isBetween( { minimum: 0, maximum: KINGDOMINO_MAX_CROWNS } )
	)
} );

/**
 * A domino's number, one to forty-eight. `DOMINO_DECK` is dense and 1-based, so
 * the id is an index into the box — bounding it here is what keeps a lookup on a
 * client-supplied id (`selectDomino`, `placeDomino`, `discardDomino`) from ever
 * reaching past the deck.
 */
export type DominoId = typeof DominoId.Type;
export const DominoId = Schema.Int.check(
	Schema.isBetween( { minimum: 1, maximum: KINGDOMINO_DECK_SIZE } )
);

export type Domino = typeof Domino.Type;
export const Domino = Schema.Struct( {
	id: DominoId,
	left: Tile,
	right: Tile
} );

export type BoardSize = typeof BoardSize.Type;
export const BoardSize = Schema.Literals( KINGDOMINO_BOARD_SIZES );

/**
 * A cell in a kingdom. Bounded to the largest window a placement could name:
 * the biggest board, plus {@link KINGDOMINO_COORD_SLACK} on either side for a
 * domino hanging off the edge that the board then slides under.
 *
 * The bound lives in the schema rather than only in `canDominoBePlaced` because
 * a move's input is the one thing the engine decodes on its way in — a
 * fractional, infinite or absurd coordinate is refused at that boundary instead
 * of being carried into the board's key space.
 */
export type Coord = typeof Coord.Type;
export const Coord = Schema.Struct( {
	x: Schema.Int.check( Schema.isBetween( {
		minimum: -KINGDOMINO_COORD_SLACK,
		maximum: Math.max( ...KINGDOMINO_BOARD_SIZES ) - 1 + KINGDOMINO_COORD_SLACK
	} ) ),
	y: Schema.Int.check( Schema.isBetween( {
		minimum: -KINGDOMINO_COORD_SLACK,
		maximum: Math.max( ...KINGDOMINO_BOARD_SIZES ) - 1 + KINGDOMINO_COORD_SLACK
	} ) )
} );

/** Which way the domino's right half lies from its anchor. */
export type Rotation = typeof Rotation.Type;
export const Rotation = Schema.Literals( [ 0, 90, 180, 270 ] );

export type Castle = typeof Castle.Type;
export const Castle = Schema.Literals( [ "red", "blue", "yellow", "green" ] );

/**
 * Where a domino goes.
 * - dominoId: Which domino, out of the caller's queue
 * - coord: The cell its left half takes
 * - rotation: Which of the four neighbours its right half takes
 */
export type Placement = typeof Placement.Type;
export const Placement = Schema.Struct( {
	dominoId: DominoId,
	coord: Coord,
	rotation: Rotation
} );

/**
 * One player's kingdom.
 * - size: The window every tile has to fit inside, 5x5 or 7x7
 * - castle: The colour of the castle at its heart
 * - placements: Every domino laid, in the coordinates it ended up at — the
 * 		board slides when a placement hangs off an edge, and the stored placements
 * 		slide with it, so they always agree with `tiles`
 * - tiles: The kingdom itself, keyed `"x,y"`
 */
export type Board = typeof Board.Type;
export const Board = Schema.Struct( {
	size: BoardSize,
	castle: Castle,
	placements: Schema.Array( Placement ),
	tiles: Schema.Record( Schema.String, Tile )
} );

/**
 * A connected run of one terrain, and what it is worth: its tiles times its
 * crowns, which is nothing at all when nobody crowned it.
 */
export type Region = typeof Region.Type;
export const Region = Schema.Struct( {
	id: Schema.String,
	terrain: Terrain,
	tiles: PositiveInt,
	placement: Schema.Array( Coord ),
	crowns: PositiveInt,
	points: PositiveInt
} );

export type ScoreBreakdown = typeof ScoreBreakdown.Type;
export const ScoreBreakdown = Schema.Struct( {
	regions: Schema.Array( Region ),
	points: PositiveInt
} );

/**
 * Everything one seat holds.
 * - board: Their kingdom, public from the first tile
 * - queue: The dominoes they have claimed but not yet laid, lowest id first
 * - score: Their kingdom's worth, recomputed as each domino lands
 */
export type PlayerData = typeof PlayerData.Type;
export const PlayerData = Schema.Struct( {
	board: Board,
	queue: Schema.Array( DominoId ),
	score: ScoreBreakdown
} );

/**
 * One domino in the row being drafted, and the seat that claimed it. A row is
 * always laid out lowest id first, which is what makes claiming a low domino a
 * real cost: it buys an early pick next round.
 */
export type DraftEntry = typeof DraftEntry.Type;
export const DraftEntry = Schema.Struct( {
	domino: Domino,
	selectedBy: Schema.optional( PlayerId )
} );


// --- Config / State / Views ------------------------------------------------------

/**
 * What a table was created with. Extends `BaseGameConfig`
 * - playerCount: How many seats, two to four
 * - boardSize: The kingdom every seat builds in. The printed game is 5x5; the
 * 		7x7 duel is a two-seat variant, since three or four kingdoms that size
 * 		would ask for more dominoes than the box holds
 */
export type KingdominoConfig = typeof KingdominoConfig.Type;
export const KingdominoConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: Schema.Literals( KINGDOMINO_PLAYER_COUNTS ),
	boardSize: BoardSize
} );

/**
 * The table and everyone at it.
 * - playerData: Every seat's kingdom, all of it public
 * - deck: What is left to draw, in order. The one private region: the order of
 * 		the undrawn dominoes is this game's whole hidden information, so it never
 * 		reaches a view — only how many are left does
 * - draft: The row being claimed, lowest id first
 * - selectionOrder: Who claims, in order, for the round being drafted. Random
 * 		for the first round and read off the previous row's claims after that
 */
export type KingdominoState = typeof KingdominoState.Type;
export const KingdominoState = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerData ),
	deck: Schema.Array( Domino ),
	draft: Schema.Array( DraftEntry ),
	selectionOrder: Schema.Array( PlayerId )
} );

/**
 * One shape for every audience. A kingdom is built face up, so the only thing a
 * table hides is what has not been turned over yet: the deck becomes its length,
 * and everything else — every board, the row on offer, who claimed what — goes
 * out as it stands.
 *
 * - deckCount: How many dominoes are still to come, so a client can show the
 * 		rounds left without learning which they are
 * - playerId: The seat this view was built for, absent on the table's
 */
export type KingdominoView = typeof KingdominoView.Type;
export const KingdominoView = Schema.Struct( {
	...KingdominoState.mapFields( Struct.omit( [ "deck" ] ) ).fields,
	deckCount: PositiveInt,
	playerId: Schema.optional( PlayerId )
} );

/** The table as one of its seats sees it — {@link SeatView} over the view above. */
export type KingdominoSeatView = typeof KingdominoSeatView.Type;
export const KingdominoSeatView = SeatView( KingdominoView );


// --- Move Inputs ------------------------------------------------------

export type SelectDominoInput = typeof SelectDominoInput.Type;
export const SelectDominoInput = Schema.Struct( { dominoId: DominoId } );

export type PlaceDominoInput = typeof PlaceDominoInput.Type;
export const PlaceDominoInput = Schema.Struct( { placement: Placement } );

export type DiscardDominoInput = typeof DiscardDominoInput.Type;
export const DiscardDominoInput = Schema.Struct( { dominoId: DominoId } );

/**
 * The input required to create a game: how many seats, and how big a kingdom.
 * Written as a union rather than one struct because the two are not independent
 * — a 7x7 kingdom needs twenty-four dominoes a seat, which only two seats can be
 * dealt out of a forty-eight domino box. A three or four seat table asking for
 * one is refused at the decode boundary instead of quietly being handed a short
 * deck it would run out of.
 *
 * - playerCount: How many seats to lay out
 * - boardSize: How big a kingdom. Absent means {@link KINGDOMINO_DEFAULT_BOARD_SIZE}
 *
 * The move clock and whether the table starts itself stay the server's to fix.
 */
export type KingdominoCreateInput = typeof KingdominoCreateInput.Type;
export const KingdominoCreateInput = Schema.Union( [
	Schema.Struct( {
		playerCount: Schema.Literal( 2 ),
		boardSize: Schema.optional( BoardSize )
	} ),
	Schema.Struct( {
		playerCount: Schema.Literals( [ 3, 4 ] ),
		boardSize: Schema.optional( Schema.Literal( KINGDOMINO_DEFAULT_BOARD_SIZE ) )
	} )
] );

export type KingdominoInitializeInput = typeof KingdominoInitializeInput.Type;
export const KingdominoInitializeInput = InitializeInput( KingdominoConfig );


// --- Domain Events ---------------------------------------------------------

/**
 * Emitted at `start`, once the seats are known: the box is shuffled and cut down
 * to the dominoes this table plays with. The order it lands in is the order
 * every later row is drawn from, so this event is the whole shuffle.
 */
export type DeckShuffled = typeof DeckShuffled.Type;
export const DeckShuffled = Schema.TaggedStruct( "kingdomino/ev/DeckShuffled", {
	deck: Schema.Array( Domino )
} );

export type PlayerBoardCreated = typeof PlayerBoardCreated.Type;
export const PlayerBoardCreated = Schema.TaggedStruct( "kingdomino/ev/PlayerBoardCreated", {
	playerId: PlayerId,
	board: Board
} );

/** The opening claim order, drawn at random: one slot per pick a seat gets. */
export type SelectionOrderSet = typeof SelectionOrderSet.Type;
export const SelectionOrderSet = Schema.TaggedStruct( "kingdomino/ev/SelectionOrderSet", {
	order: Schema.Array( PlayerId )
} );

/**
 * Emitted on entering a draft: the row turned face up, lowest id first. Only the
 * row rides the event — the deck it came off the front of is sliced by the same
 * count in the reducer, so the log never carries a second copy of the shuffle.
 */
export type DraftDrawn = typeof DraftDrawn.Type;
export const DraftDrawn = Schema.TaggedStruct( "kingdomino/ev/DraftDrawn", {
	draft: Schema.Array( DraftEntry ),
	deck: Schema.Array( Domino )
} );

export type DominoSelected = typeof DominoSelected.Type;
export const DominoSelected = Schema.TaggedStruct( "kingdomino/ev/DominoSelected", {
	dominoId: DominoId,
	playerId: PlayerId
} );

export type DominoPlaced = typeof DominoPlaced.Type;
export const DominoPlaced = Schema.TaggedStruct( "kingdomino/ev/DominoPlaced", {
	playerId: PlayerId,
	dominoId: Schema.Number,
	board: Board,
	score: ScoreBreakdown
} );

export type DominoDiscarded = typeof DominoDiscarded.Type;
export const DominoDiscarded = Schema.TaggedStruct( "kingdomino/ev/DominoDiscarded", {
	playerId: PlayerId,
	dominoId: DominoId
} );

/** The next round's claim order, read off the row just played out. */
export type SelectionOrderRecomputed = typeof SelectionOrderRecomputed.Type;
export const SelectionOrderRecomputed = Schema.TaggedStruct(
	"kingdomino/ev/SelectionOrderRecomputed",
	{ order: Schema.Array( PlayerId ) }
);

/**
 * Emitted as a draft closes with dominoes nobody claimed — a table of three
 * leaves one behind every round. The ids are recorded rather than recomputed so
 * the log says what left the game, and a replay follows the event rather than
 * re-deriving it.
 */
export type DraftPruned = typeof DraftPruned.Type;
export const DraftPruned = Schema.TaggedStruct( "kingdomino/ev/DraftPruned", {
	dominoIds: Schema.Array( DominoId )
} );

export type KingdominoEvent = typeof KingdominoEvent.Type;
export const KingdominoEvent = Schema.Union( [
	DeckShuffled,
	PlayerBoardCreated,
	SelectionOrderSet,
	DraftDrawn,
	DominoSelected,
	DominoPlaced,
	DominoDiscarded,
	DraftPruned,
	SelectionOrderRecomputed
] );
