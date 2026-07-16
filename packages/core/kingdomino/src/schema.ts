// @s2h/kingdomino/schema — Effect Schema definitions for the Kingdomino game.
//
// Pure / browser-safe: imports only `effect` + the shared swish schema. Defines
// the game's config / state / views, its per-move input schemas, its full set of
// domain events (+ their union), the client snapshot, and the `KingdominoData`
// UI aggregate. Each schema is dual-exported (const value + `.Type` alias).

import { BaseGameConfig, type BaseGameData, GameSnapshot, PlayerId } from "@s2h/swish/schema";
import * as Schema from "effect/Schema";

// --- Board primitives ------------------------------------------------------

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

// --- Config / state / views ------------------------------------------------

export type KingdominoConfig = typeof KingdominoConfig.Type;
export const KingdominoConfig = Schema.Struct( {
	...BaseGameConfig.fields,
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

// Shared view hides the remaining deck (the same `Omit<…, "deck">` as before).
export type KingdominoSharedView = typeof KingdominoSharedView.Type;
export const KingdominoSharedView = Schema.Struct( {
	playerData: Schema.Record( PlayerId, PlayerData ),
	draft: Schema.Array( DraftEntry ),
	selectionOrder: Schema.Array( PlayerId ),
	winner: Schema.optional( PlayerId )
} );

export type KingdominoPlayerView = typeof KingdominoPlayerView.Type;
export const KingdominoPlayerView = Schema.Struct( { playerId: PlayerId } );

// The single audience view: the shared board (deck hidden), plus `playerId` for
// a Player audience (absent for the Table / spectator audience).
export type KingdominoView = typeof KingdominoView.Type;
export const KingdominoView = Schema.Struct( {
	...KingdominoSharedView.fields,
	playerId: Schema.optional( PlayerId )
} );

export type KingdominoSnapshot = typeof KingdominoSnapshot.Type;
export const KingdominoSnapshot = GameSnapshot( KingdominoView, KingdominoConfig );

// --- Move inputs (one per move; also each RPC's wire schema) ----------------

export type SelectDominoInput = typeof SelectDominoInput.Type;
export const SelectDominoInput = Schema.Struct( { dominoId: Schema.Number } );

export type PlaceDominoInput = typeof PlaceDominoInput.Type;
export const PlaceDominoInput = Schema.Struct( { placement: Placement } );

export type DiscardDominoInput = typeof DiscardDominoInput.Type;
export const DiscardDominoInput = Schema.Struct( { dominoId: Schema.Number } );

// --- Domain events ---------------------------------------------------------
// Each event captures the exact (already-resolved, possibly random) data so the
// pure `apply` reducer can fold it deterministically.

/** Deck was shuffled at start — carries the exact shuffled deck. */
export type DeckShuffled = typeof DeckShuffled.Type;
export const DeckShuffled = Schema.TaggedStruct( "kingdomino/DeckShuffled", {
	deck: Schema.Array( Domino )
} );

/** A player joined — their empty board (with castle) is seeded. */
export type PlayerBoardCreated = typeof PlayerBoardCreated.Type;
export const PlayerBoardCreated = Schema.TaggedStruct( "kingdomino/PlayerBoardCreated", {
	playerId: PlayerId,
	board: Board
} );

/** The shuffled first-round selection order was decided at start. */
export type SelectionOrderSet = typeof SelectionOrderSet.Type;
export const SelectionOrderSet = Schema.TaggedStruct( "kingdomino/SelectionOrderSet", {
	order: Schema.Array( PlayerId )
} );

/** A new draft was drawn from the deck — carries the drawn entries + remaining deck. */
export type DraftDrawn = typeof DraftDrawn.Type;
export const DraftDrawn = Schema.TaggedStruct( "kingdomino/DraftDrawn", {
	draft: Schema.Array( DraftEntry ),
	deck: Schema.Array( Domino )
} );

/** Unselected draft entries were dropped when the SELECT phase exited. */
export type DraftPruned = typeof DraftPruned.Type;
export const DraftPruned = Schema.TaggedStruct( "kingdomino/DraftPruned", {} );

/** A player claimed a draft domino; it enters their placement queue. */
export type DominoSelected = typeof DominoSelected.Type;
export const DominoSelected = Schema.TaggedStruct( "kingdomino/DominoSelected", {
	dominoId: Schema.Number,
	playerId: PlayerId
} );

/**
 * A domino was placed. Because a placement may shift the whole board, the
 * decider computes the resulting board + score and stores them in the event so
 * `apply` is a pure assignment.
 */
export type DominoPlaced = typeof DominoPlaced.Type;
export const DominoPlaced = Schema.TaggedStruct( "kingdomino/DominoPlaced", {
	playerId: PlayerId,
	dominoId: Schema.Number,
	board: Board,
	score: ScoreBreakdown
} );

/** A domino that could not be legally placed was discarded from the queue. */
export type DominoDiscarded = typeof DominoDiscarded.Type;
export const DominoDiscarded = Schema.TaggedStruct( "kingdomino/DominoDiscarded", {
	playerId: PlayerId,
	dominoId: Schema.Number
} );

/** The next-round selection order was recomputed from the resolved draft. */
export type SelectionOrderRecomputed = typeof SelectionOrderRecomputed.Type;
export const SelectionOrderRecomputed = Schema.TaggedStruct( "kingdomino/SelectionOrderRecomputed", {
	order: Schema.Array( PlayerId )
} );

/** The winner (highest score) was decided at game end. */
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

// --- UI aggregate ----------------------------------------------------------

export type KingdominoData = BaseGameData & {
	config: typeof KingdominoConfig.Type;
	shared: typeof KingdominoSharedView.Type;
	player: typeof KingdominoPlayerView.Type;
};
