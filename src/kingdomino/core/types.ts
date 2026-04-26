// ============================================================================
// Tiles & Dominoes
// ============================================================================

import type {
	BaseGameConfig,
	BasePlayerView,
	GameId,
	PlayerGameData,
	PlayerId,
	SharedGameData
} from "@/shared/engine/types";

/** The castle color assigned to each player. */
export type Castle = "red" | "blue" | "yellow" | "green";

/** The terrain types available for tiles on the board. */
export type Terrain =
	| "castle"
	| "desert"
	| "forest"
	| "water"
	| "grassland"
	| "wasteland"
	| "mine";

/** A single tile with a terrain type and crown count. */
export type Tile = {
	terrain: Terrain;
	crowns: number;
};

/** Numeric identifier for a domino (1-48). */
export type DominoId = number;

/** A domino piece with two tiles (left and right). */
export type Domino = {
	id: DominoId;
	left: Tile;
	right: Tile;
};

// ============================================================================
// Board Coordinates & Placements
// ============================================================================

/** A coordinate on the board grid. */
export type Coord = { x: number; y: number; };

/** Board size: 5x5 for standard play or 7x7 for extended. */
export type BoardSize = 5 | 7;

/** Rotation of a domino: 0=right, 90=down, 180=left, 270=up. */
export type Rotation = 0 | 90 | 180 | 270;

/** Map of coordinate keys to tiles placed on the board. */
export type Tiles = Record<string, Tile>;

/** A domino placement specifying which domino, where, and at what rotation. */
export type Placement = {
	dominoId: DominoId;
	coord: Coord; // top-left coordinate
	rotation: Rotation; // 0 = horizontal (right), 90 = vertical (down), 180 = horizontal inverted (left), 270 = vertical inverted (up)
};

/** Rectangular bounding box defined by min/max coordinates. */
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

/** A player's board containing placed tiles, castle, and board size. */
export type Board = {
	size: BoardSize;
	castle: Castle;
	placements: Placement[];
	tiles: Tiles; // coordinate key -> tile mapping for quick lookup
};

// ============================================================================
// Scoring
// ============================================================================

/** A connected region of same-terrain tiles with its score calculation. */
export type Region = {
	id: string;
	terrain: Terrain;
	tiles: number; // number of tiles in this region
	placement: Coord[]; // all tile coords in this region
	crowns: number;
	points: number; // tiles * crowns
};

/** Score breakdown showing all regions and total points. */
export type ScoreBreakdown = {
	regions: Region[];
	points: number;
};

// ============================================================================
// Draft
// ============================================================================

/** A draft entry: a domino available for selection, optionally claimed by a player. */
export type DraftEntry = {
	domino: Domino;
	selectedBy?: PlayerId;
};

// ============================================================================
// Server-Side Game State (Includes Hidden Information)
// ============================================================================

/** Per-player game data with their board, queued dominoes, and current score. */
export type PlayerInfo = {
	board: Board;
	queue: DominoId[];
	score: ScoreBreakdown;
};

/** Server-side Kingdomino game state including deck, draft, and all player data. */
export type KingdominoData = {
	playerData: Record<PlayerId, PlayerInfo>;
	deck: Domino[];
	draft: DraftEntry[];
	selectionOrder: PlayerId[];
	winner?: PlayerId;
};

/** Kingdomino game configuration with board size. */
export type KingdominoConfig = BaseGameConfig & { boardSize: BoardSize; }

/** Shared view hiding the remaining deck. */
export type KingdominoSharedView = Omit<KingdominoData, "deck">;

/** Player view (no player-specific hidden info). */
export type KingdominoPlayerView = BasePlayerView;

/** Complete Kingdomino game data type with split shared/player state. */
export type KingdominoGame = {
	shared: SharedGameData<KingdominoSharedView, KingdominoConfig>;
	player: PlayerGameData<KingdominoPlayerView>;
};

// ============================================================================
// Input Types
// ============================================================================

/** Input for creating a new Kingdomino game with player count and board size. */
export type CreateGameInput = {
	playerCount: 2 | 3 | 4;
	boardSize: 5 | 7;
}

/** Input for selecting a domino from the draft. */
export type SelectDominoInput = {
	gameId: GameId;
	dominoId: DominoId;
};

/** Input for placing a domino on the board with position and rotation. */
export type PlaceDominoInput = {
	gameId: GameId;
	placement: Placement;
};

/** Input for discarding a domino that cannot be legally placed. */
export type DiscardDominoInput = {
	gameId: GameId;
	dominoId: DominoId;
};

/** Map of all Kingdomino move types to their input types. */
export type KingdominoMoves = {
	selectDomino: SelectDominoInput;
	placeDomino: PlaceDominoInput;
	discardDomino: DiscardDominoInput;
};
