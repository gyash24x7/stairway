import { assert, describe, it } from "@effect/vitest";

import { GAME_NAMES } from "@/shared/games";
import { findPath, isStep, isWalkable, roomAt, tableNear, tileAt, WORLD } from "@/world/map";


describe( "world map", () => {

	it( "gives every game a room with tables", () => {
		for ( const game of GAME_NAMES ) {
			const room = WORLD.rooms.find( r => r.game === game );
			assert.isDefined( room, game );
			assert.isAbove( room!.tables.length, 0 );
			for ( const table of room!.tables ) {
				assert.strictEqual( tileAt( table ), "table" );
			}
		}
	} );

	it( "spawns on walkable ground outside every room", () => {
		assert.isTrue( isWalkable( WORLD.spawn ) );
		assert.isUndefined( roomAt( WORLD.spawn ) );
	} );

	it( "refuses walls, tables and the outside of the map", () => {
		assert.isFalse( isWalkable( { x: 0, y: 0 } ) );
		assert.isFalse( isWalkable( { x: -1, y: 3 } ) );
		assert.isFalse( isWalkable( { x: WORLD.width, y: 3 } ) );
		assert.isFalse( isWalkable( WORLD.rooms[ 0 ]!.tables[ 0 ]! ) );
	} );

	it( "counts the doorway as outside and the tile past it as inside", () => {
		for ( const room of WORLD.rooms ) {
			assert.strictEqual( tileAt( room.door ), "door" );
			assert.isUndefined( roomAt( room.door ) );
		}
		const room = WORLD.rooms[ 0 ]!;
		assert.strictEqual( roomAt( { x: room.door.x, y: room.door.y - 1 } ), room );
	} );

	it( "reaches every room's tables from the spawn point", () => {
		for ( const room of WORLD.rooms.filter( r => r.game ) ) {
			for ( const [ index, table ] of room.tables.entries() ) {
				const beside = [ { x: table.x, y: table.y + 1 }, { x: table.x, y: table.y - 1 } ]
					.find( p => isWalkable( p ) )!;
				const path = findPath( WORLD.spawn, beside );
				assert.isAbove( path.length, 0 );
				path.reduce( ( from, to ) => {
					assert.isTrue( isStep( from, to ) );
					assert.isTrue( isWalkable( to ) );
					return to;
				}, WORLD.spawn );
				assert.deepStrictEqual( tableNear( beside ), { room, index } );
			}
		}
	} );

	it( "finds no path to a wall or to where you already are", () => {
		assert.deepStrictEqual( findPath( WORLD.spawn, { x: 0, y: 0 } ), [] );
		assert.deepStrictEqual( findPath( WORLD.spawn, WORLD.spawn ), [] );
	} );

} );
