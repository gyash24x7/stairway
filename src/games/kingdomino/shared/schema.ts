import * as Schema from "effect/Schema";

import {
	BaseGameConfig,
	GameSnapshot,
	InitializeInput,
	PlayerId
} from "@/shared/swish/schema.ts";


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
	crowns: Schema.Number
} );

export type Domino = typeof Domino.Type;
export const Domino = Schema.Struct( {
	id: Schema.Number,
	left: Tile,
	right: Tile
} );

export type Coord = typeof Coord.Type;
export const Coord = Schema.Struct( { x: Schema.Number, y: Schema.Number } );

export type Rotation = typeof Rotation.Type;
export const Rotation = Schema.Literals( [ 0, 90, 180, 270 ] );

export type Castle = typeof Castle.Type;
export const Castle = Schema.Literals( [ "red", "blue", "yellow", "green" ] );

export type BoardSize = typeof BoardSize.Type;
export const BoardSize = Schema.Literals( [ 5, 7 ] );

export type Placement = typeof Placement.Type;
export const Placement = Schema.Struct( {
	dominoId: Schema.Number,
	coord: Coord,
	rotation: Rotation
} );

export type Board = typeof Board.Type;
export const Board = Schema.Struct( {
	size: BoardSize,
	castle: Castle,
	placements: Schema.Array( Placement ),
	tiles: Schema.Record( Schema.String, Tile )
} );

export type Region = typeof Region.Type;
export const Region = Schema.Struct( {
	id: Schema.String,
	terrain: Terrain,
	tiles: Schema.Number,
	placement: Schema.Array( Coord ),
	crowns: Schema.Number,
	points: Schema.Number
} );

export type ScoreBreakdown = typeof ScoreBreakdown.Type;
export const ScoreBreakdown = Schema.Struct( {
	regions: Schema.Array( Region ),
	points: Schema.Number
} );

export type PlayerData = typeof PlayerData.Type;
export const PlayerData = Schema.Struct( {
	board: Board,
	queue: Schema.Array( Schema.Number ),
	score: ScoreBreakdown
} );

export type DraftEntry = typeof DraftEntry.Type;
export const DraftEntry = Schema.Struct( {
	domino: Domino,
	selectedBy: Schema.optional( PlayerId )
} );


// --- Config / State / Views ------------------------------------------------------

/**
 * Kingdomino seats 2-4: there are exactly four castle colours (`CASTLES`), and
 * the draft rhythm is derived from the count (`getSelectionsPerPlayer`). A fifth
 * seat would index past the castle list.
 */
export const KINGDOMINO_PLAYER_COUNTS = [ 2, 3, 4 ] as const;

export type KingdominoConfig = typeof KingdominoConfig.Type;
export const KingdominoConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: Schema.Literals( KINGDOMINO_PLAYER_COUNTS ),
	boardSize: BoardSize
} );

export type KingdominoState = typeof KingdominoState.Type;
export const KingdominoState = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerData ),
	deck: Schema.Array( Domino ),
	draft: Schema.Array( DraftEntry ),
	selectionOrder: Schema.Array( PlayerId ),
	winner: Schema.optional( PlayerId )
} );

// Everything except the hidden `deck` is public; the only private field is the
// viewer's own `playerId`. `KingdominoView` is the discriminated union of the
// player and table variants — clients narrow once on `_tag`.
export type KingdominoSharedView = typeof KingdominoSharedView.Type;
export const KingdominoSharedView = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerData ),
	draft: Schema.Array( DraftEntry ),
	selectionOrder: Schema.Array( PlayerId ),
	winner: Schema.optional( PlayerId )
} );

export type KingdominoPlayerView = typeof KingdominoPlayerView.Type;
export const KingdominoPlayerView = Schema.TaggedStruct( "kingdomino/PlayerView", {
	...KingdominoSharedView.fields,
	playerId: PlayerId
} );

export type KingdominoTableView = typeof KingdominoTableView.Type;
export const KingdominoTableView = Schema.TaggedStruct( "kingdomino/TableView", {
	...KingdominoSharedView.fields
} );

export type KingdominoView = typeof KingdominoView.Type;
export const KingdominoView = Schema.Union( [ KingdominoPlayerView, KingdominoTableView ] );

export type KingdominoSnapshot = typeof KingdominoSnapshot.Type;
export const KingdominoSnapshot = GameSnapshot( KingdominoView, KingdominoConfig );


// --- Move Inputs ------------------------------------------------------

export type SelectDominoInput = typeof SelectDominoInput.Type;
export const SelectDominoInput = Schema.Struct( { dominoId: Schema.Number } );

export type PlaceDominoInput = typeof PlaceDominoInput.Type;
export const PlaceDominoInput = Schema.Struct( { placement: Placement } );

export type DiscardDominoInput = typeof DiscardDominoInput.Type;
export const DiscardDominoInput = Schema.Struct( { dominoId: Schema.Number } );

export type KingdominoInitializeInput = typeof KingdominoInitializeInput.Type;
export const KingdominoInitializeInput = InitializeInput( KingdominoConfig );

// --- Domain Events ---------------------------------------------------------

export type DeckShuffled = typeof DeckShuffled.Type;
export const DeckShuffled = Schema.TaggedStruct( "kingdomino/DeckShuffled", {
	deck: Schema.Array( Domino )
} );

export type PlayerBoardCreated = typeof PlayerBoardCreated.Type;
export const PlayerBoardCreated = Schema.TaggedStruct( "kingdomino/PlayerBoardCreated", {
	playerId: PlayerId,
	board: Board
} );

export type SelectionOrderSet = typeof SelectionOrderSet.Type;
export const SelectionOrderSet = Schema.TaggedStruct( "kingdomino/SelectionOrderSet", {
	order: Schema.Array( PlayerId )
} );

export type DraftDrawn = typeof DraftDrawn.Type;
export const DraftDrawn = Schema.TaggedStruct( "kingdomino/DraftDrawn", {
	draft: Schema.Array( DraftEntry ),
	deck: Schema.Array( Domino )
} );

export type DraftPruned = typeof DraftPruned.Type;
export const DraftPruned = Schema.TaggedStruct( "kingdomino/DraftPruned", {} );

export type DominoSelected = typeof DominoSelected.Type;
export const DominoSelected = Schema.TaggedStruct( "kingdomino/DominoSelected", {
	dominoId: Schema.Number,
	playerId: PlayerId
} );

export type DominoPlaced = typeof DominoPlaced.Type;
export const DominoPlaced = Schema.TaggedStruct( "kingdomino/DominoPlaced", {
	playerId: PlayerId,
	dominoId: Schema.Number,
	board: Board,
	score: ScoreBreakdown
} );

export type DominoDiscarded = typeof DominoDiscarded.Type;
export const DominoDiscarded = Schema.TaggedStruct( "kingdomino/DominoDiscarded", {
	playerId: PlayerId,
	dominoId: Schema.Number
} );

export type SelectionOrderRecomputed = typeof SelectionOrderRecomputed.Type;
export const SelectionOrderRecomputed = Schema.TaggedStruct(
	"kingdomino/SelectionOrderRecomputed",
	{ order: Schema.Array( PlayerId ) }
);

export type WinnerDecided = typeof WinnerDecided.Type;
export const WinnerDecided = Schema.TaggedStruct( "kingdomino/WinnerDecided", {
	winner: PlayerId
} );

export type KingdominoEvent = typeof KingdominoEvent.Type;
export const KingdominoEvent = Schema.Union( [
	DeckShuffled,
	PlayerBoardCreated,
	SelectionOrderSet,
	DraftDrawn,
	DraftPruned,
	DominoSelected,
	DominoPlaced,
	DominoDiscarded,
	SelectionOrderRecomputed,
	WinnerDecided
] );
