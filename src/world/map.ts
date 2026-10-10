import type { GameName } from "@/shared/games";
import { GAME_NAMES } from "@/shared/games";


/**
 * The arena's floor plan. The server checks moves against it and the client
 * draws it, so it is plain data with no rendering in it, and both import this
 * same module.
 *
 * It is generated rather than drawn by hand, from `GAME_NAMES`. A row of rooms
 * runs along the top, a plaza fills the middle, and a second row of rooms runs
 * along the bottom. Each game in the registry gets the next room, so a new game
 * gets a room without anyone editing this file. Room slots with no game left
 * over become lounges.
 */

export type TileKind = "floor" | "plaza" | "wall" | "door" | "table" | "plant";

export type Pos = { readonly x: number; readonly y: number };

export type Room = {
	/** The game this room hosts, or null for a lounge. */
	readonly game: GameName | null;
	/** The walkable interior, inclusive, without the walls. */
	readonly bounds: {
		readonly x0: number;
		readonly y0: number;
		readonly x1: number;
		readonly y1: number;
	};
	readonly door: Pos;
	/**
	 * Where the tables stand, in a fixed order. The world assigns open tables to
	 * these spots in the order the lobby lists them, so whoever lists first gets
	 * the first spot.
	 */
	readonly tables: ReadonlyArray<Pos>;
};

export type WorldMap = {
	readonly width: number;
	readonly height: number;
	/** Row-major: the tile at (x, y) is `tiles[ y * width + x ]`. */
	readonly tiles: ReadonlyArray<TileKind>;
	readonly rooms: ReadonlyArray<Room>;
	readonly spawn: Pos;
};

/** Each tile's edge in pixels. Only the renderer uses it; game logic counts tiles. */
export const TILE_SIZE = 32;

const COLUMNS = 4;
/** A room's outer width. Neighbouring rooms share a wall, so they sit this far apart minus one. */
const ROOM_W = 11;
const ROOM_H = 8;
const PLAZA_H = 7;

/**
 * Where tables go inside a room, relative to the room's top-left wall corner.
 *
 * Any two tables are at least three tiles apart, so no tile is beside two of
 * them at once. Otherwise `tableNear` could not tell which table someone
 * standing there means to sit at.
 */
const TABLE_SPOTS: ReadonlyArray<Pos> = [
	{ x: 3, y: 2 },
	{ x: 7, y: 2 },
	{ x: 3, y: 5 },
	{ x: 7, y: 5 }
];

/** Plants in each lounge, at the same corner-relative offsets. */
const LOUNGE_PLANTS: ReadonlyArray<Pos> = [
	{ x: 2, y: 2 },
	{ x: 8, y: 2 },
	{ x: 5, y: 3 },
	{ x: 2, y: 5 },
	{ x: 8, y: 5 }
];

function buildMap(): WorldMap {
	const width = COLUMNS * ( ROOM_W - 1 ) + 1;
	const height = ROOM_H * 2 + PLAZA_H;
	const tiles: Array<TileKind> = Array.from(
		{ length: width * height },
		() => "plaza" as TileKind
	);

	const set = ( x: number, y: number, kind: TileKind ) => {
		tiles[ y * width + x ] = kind;
	};

	// The outer wall.
	for ( let x = 0; x < width; x++ ) {
		set( x, 0, "wall" );
		set( x, height - 1, "wall" );
	}

	for ( let y = 0; y < height; y++ ) {
		set( 0, y, "wall" );
		set( width - 1, y, "wall" );
	}

	const rooms: Array<Room> = [];
	const slots = COLUMNS * 2;
	for ( let slot = 0; slot < slots; slot++ ) {
		const top = slot < COLUMNS;
		const left = ( slot % COLUMNS ) * ( ROOM_W - 1 );
		const y0 = top ? 0 : height - ROOM_H;
		const x1 = left + ROOM_W - 1;
		const y1 = y0 + ROOM_H - 1;

		for ( let y = y0; y <= y1; y++ ) {
			for ( let x = left; x <= x1; x++ ) {
				const edge = x === left || x === x1 || y === y0 || y === y1;
				set( x, y, edge ? "wall" : "floor" );
			}
		}

		// The door is in the wall that faces the plaza.
		const door = { x: left + Math.floor( ROOM_W / 2 ), y: top ? y1 : y0 };
		set( door.x, door.y, "door" );

		const game = GAME_NAMES[ slot ] ?? null;

		// Bottom-row rooms are mirrored top to bottom, so their tables still sit
		// on the side away from the door.
		const place = ( p: Pos ) => ( { x: left + p.x, y: top ? y0 + p.y : y1 - p.y } );
		const tables = game ? TABLE_SPOTS.map( place ) : [];
		for ( const t of tables ) {
			set( t.x, t.y, "table" );
		}

		if ( !game ) {
			for ( const p of LOUNGE_PLANTS.map( place ) ) {
				set( p.x, p.y, "plant" );
			}
		}

		const bounds = { x0: left + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 };
		rooms.push( { game, bounds, door, tables } );
	}

	// A few plants along the plaza's edges, kept clear of the doors.
	const plazaTop = ROOM_H;
	const plazaBottom = height - ROOM_H - 1;
	for ( let x = 3; x < width - 3; x += 5 ) {
		if ( rooms.some( r => Math.abs( r.door.x - x ) <= 1 ) ) {
			continue;
		}

		set( x, plazaTop, "plant" );
		set( x, plazaBottom, "plant" );
	}

	const spawn = { x: Math.floor( width / 2 ), y: ROOM_H + Math.floor( PLAZA_H / 2 ) };
	return { width, height, tiles, rooms, spawn };
}

export const WORLD: WorldMap = buildMap();

export const tileAt = ( pos: Pos, map: WorldMap = WORLD ): TileKind | undefined =>
	pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height
		? undefined
		: map.tiles[ pos.y * map.width + pos.x ];

export const isWalkable = ( pos: Pos, map: WorldMap = WORLD ) => {
	const tile = tileAt( pos, map );
	return tile === "floor" || tile === "plaza" || tile === "door";
};

const inside = ( pos: Pos, room: Room ) =>
	pos.x >= room.bounds.x0 && pos.x <= room.bounds.x1
	&& pos.y >= room.bounds.y0 && pos.y <= room.bounds.y1;

/** The room `pos` stands in. The doorway counts as outside, so you are in a room only once you are through the door. */
export const roomAt = ( pos: Pos, map: WorldMap = WORLD ): Room | undefined =>
	map.rooms.find( room => inside( pos, room ) );

/**
 * The table `pos` is next to, as an index into its room's `tables`.
 *
 * You cannot stand on a table, so you sit at one by standing on one of the four
 * tiles beside it.
 */
export const tableNear = ( pos: Pos, map: WorldMap = WORLD ) => {
	const room = roomAt( pos, map );
	if ( !room ) {
		return undefined;
	}

	const index = room.tables.findIndex(
		t => Math.abs( t.x - pos.x ) + Math.abs( t.y - pos.y ) === 1
	);

	return index === -1 ? undefined : { room, index };
};

/** Whether `to` is one orthogonal step from `from`. Only these single steps are legal moves. */
export const isStep = ( from: Pos, to: Pos ) =>
	Math.abs( from.x - to.x ) + Math.abs( from.y - to.y ) === 1;

export const samePos = ( a: Pos, b: Pos ) => a.x === b.x && a.y === b.y;

/**
 * The shortest walk from `from` to `to`, excluding `from`. Used for
 * click-to-walk. Returns an empty array if `to` cannot be reached or is where
 * you already are.
 */
export function findPath( from: Pos, to: Pos, map: WorldMap = WORLD ): Array<Pos> {
	if ( !isWalkable( to, map ) || samePos( from, to ) ) {
		return [];
	}

	const key = ( p: Pos ) => p.y * map.width + p.x;
	const previous = new Map<number, Pos>( [ [ key( from ), from ] ] );
	const queue: Array<Pos> = [ from ];
	while ( queue.length > 0 ) {
		const at = queue.shift()!;
		if ( samePos( at, to ) ) {
			const path: Array<Pos> = [];
			for ( let p = at; !samePos( p, from ); p = previous.get( key( p ) )! ) {
				path.unshift( p );
			}

			return path;
		}

		const nextCoords = [
			{ x: at.x + 1, y: at.y },
			{ x: at.x - 1, y: at.y },
			{ x: at.x, y: at.y + 1 },
			{ x: at.x, y: at.y - 1 }
		];

		for ( const next of nextCoords ) {
			if ( isWalkable( next, map ) && !previous.has( key( next ) ) ) {
				previous.set( key( next ), at );
				queue.push( next );
			}
		}
	}
	return [];
}
