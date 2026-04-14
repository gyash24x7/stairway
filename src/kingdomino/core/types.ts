// ============================================================================
// Tiles & Dominoes
// ============================================================================

import type { BaseGameConfig, Match, MatchId, PlayerId } from "@/shared/engine/types";

export type Castle = "red" | "blue" | "yellow" | "green";

export type Terrain =
	| "castle"
	| "desert"
	| "forest"
	| "water"
	| "grassland"
	| "wasteland"
	| "mine";

export type Tile = {
	terrain: Terrain;
	crowns: number;
};

export type DominoId = number;
export type Domino = {
	id: DominoId;
	left: Tile;
	right: Tile;
};

// ============================================================================
// Board Coordinates & Placements
// ============================================================================

export type Coord = { x: number; y: number; };
export type BoardSize = 5 | 7; // 5x5 or 7x7
export type Rotation = 0 | 90 | 180 | 270;

export type Tiles = Record<string, Tile>; // coordinate key -> tile mapping

export type Placement = {
	dominoId: DominoId;
	coord: Coord; // top-left coordinate
	rotation: Rotation; // 0 = horizontal (right), 90 = vertical (down), 180 = horizontal inverted (left), 270 = vertical inverted (up)
};

export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export type Board = {
	size: BoardSize;
	castle: Castle;
	placements: Placement[];
	tiles: Tiles; // coordinate key -> tile mapping for quick lookup
};

// ============================================================================
// Scoring
// ============================================================================

export type Region = {
	id: string;
	terrain: Terrain;
	tiles: number; // number of tiles in this region
	placement: Coord[]; // all tile coords in this region
	crowns: number;
	points: number; // tiles * crowns
};

export type ScoreBreakdown = {
	regions: Region[];
	points: number;
};

// ============================================================================
// Draft
// ============================================================================

export type DraftEntry = {
	domino: Domino;
	selectedBy?: PlayerId;
};

// ============================================================================
// Server-Side Game State (Includes Hidden Information)
// ============================================================================

export type PlayerInfo = {
	board: Board;
	queue: DominoId[];
	score: ScoreBreakdown;
};

export type KingdominoData = {
	playerData: Record<PlayerId, PlayerInfo>;
	deck: Domino[];
	draft: DraftEntry[];
	phase: "select" | "place";
	selectionOrder: PlayerId[];
};

export type KingdominoConfig = BaseGameConfig & { boardSize: BoardSize; }

export type KingdominoPlayerView = Omit<KingdominoData, "deck"> & { playerId: PlayerId; }

export type KingdominoMatch = Match<KingdominoPlayerView, KingdominoConfig>;

// ============================================================================
// Input Types
// ============================================================================

export type SelectDominoInput = {
	matchId: MatchId;
	dominoId: DominoId;
};

export type PlaceDominoInput = {
	matchId: MatchId;
	placement: Placement;
};

export type DiscardDominoInput = {
	matchId: MatchId;
	dominoId: DominoId;
};
