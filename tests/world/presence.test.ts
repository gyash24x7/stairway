import * as Effect from "effect/Effect";
import * as PubSub from "effect/PubSub";

import { assert, describe, it } from "@effect/vitest";

import * as TestClock from "effect/testing/TestClock";

import { User, UserId } from "@/auth/schema";
import { WORLD } from "@/world/map";
import {
	LeftEvent,
	MovedEvent,
	MoveEvent,
	SaidEvent,
	SayEvent,
	SetStatusEvent,
	StatusChangedEvent
} from "@/world/schema";
import {
	MIN_STEP_INTERVAL,
	STEP_BURST,
	WorldPresence,
	WorldPresenceLive
} from "@/world/server/presence";


const user = ( name: string ) => User.make( {
	id: UserId.make( Bun.randomUUIDv7() ),
	name,
	username: name,
	avatar: `avatar://${ name }`
} );

const right = { x: WORLD.spawn.x + 1, y: WORLD.spawn.y };

/** Walks to the tile one step inside the first room, through its door. */
const pathIntoFirstRoom = () => {
	const room = WORLD.rooms[ 0 ]!;
	const steps = [];
	for ( let x = WORLD.spawn.x; x !== room.door.x; x += Math.sign( room.door.x - x ) ) {
		steps.push( { x: x + Math.sign( room.door.x - x ), y: WORLD.spawn.y } );
	}
	for ( let y = WORLD.spawn.y - 1; y >= room.door.y - 1; y-- ) {
		steps.push( { x: room.door.x, y } );
	}
	return { room, steps };
};

describe( "world presence", () => {

	it.effect(
		"places a joiner at the spawn and shows them who is already there",
		() => Effect.gen( function* () {
			const presence = yield* WorldPresence;
			const alice = yield* presence.join( user( "alice" ) );
			const bob = yield* presence.join( user( "bob" ) );

			assert.deepStrictEqual( alice.self.pos, WORLD.spawn );
			assert.deepStrictEqual( alice.others, [] );
			assert.deepStrictEqual( bob.others.map( a => a.connId ), [ alice.self.connId ] );
			assert.notStrictEqual( alice.self.connId, bob.self.connId );

			const seen = yield* PubSub.take( alice.events );
			assert.strictEqual( seen._tag, "world/evt/Joined" );
		} ).pipe( Effect.scoped, Effect.provide( WorldPresenceLive ) )
	);

	it.effect( "broadcasts a legal step", () => Effect.gen( function* () {
		const presence = yield* WorldPresence;
		const alice = yield* presence.join( user( "alice" ) );
		yield* PubSub.take( alice.events );

		yield* presence.handle( alice.self.connId, MoveEvent.make( { pos: right, facing: "right" } ) );
		const event = yield* PubSub.take( alice.events );

		assert.deepStrictEqual( event, MovedEvent.make( {
			connId: alice.self.connId,
			pos: right,
			facing: "right",
			room: null
		} ) );
	} ).pipe( Effect.scoped, Effect.provide( WorldPresenceLive ) ) );

	it.effect(
		"answers an illegal step with the position it kept",
		() => Effect.gen( function* () {
			const presence = yield* WorldPresence;
			const alice = yield* presence.join( user( "alice" ) );
			yield* PubSub.take( alice.events );

			const illegal = [
				{ x: WORLD.spawn.x + 1, y: WORLD.spawn.y + 1 },
				{ x: WORLD.spawn.x + 2, y: WORLD.spawn.y },
				{ x: 0, y: 0 }
			];

			for ( const pos of illegal ) {
				yield* TestClock.adjust( MIN_STEP_INTERVAL );
				yield* presence.handle( alice.self.connId, MoveEvent.make( { pos, facing: "up" } ) );
				const event = yield* PubSub.take( alice.events );
				assert.strictEqual( event._tag, "world/evt/Moved" );
				assert.deepStrictEqual( event._tag === "world/evt/Moved" && event.pos, WORLD.spawn );
			}
		} ).pipe( Effect.scoped, Effect.provide( WorldPresenceLive ) )
	);

	it.effect(
		"lets a short burst of steps through, then holds to the pace",
		() => Effect.gen( function* () {
			const presence = yield* WorldPresence;
			const alice = yield* presence.join( user( "alice" ) );
			const walk = ( dx: number ) => presence.handle( alice.self.connId, MoveEvent.make( {
				pos: { x: WORLD.spawn.x + dx, y: WORLD.spawn.y },
				facing: "right"
			} ) );

			const x = presence.avatars.pipe( Effect.map( ( [ me ] ) => me!.pos.x - WORLD.spawn.x ) );

			// Bunched together, as the network might deliver them.
			for ( let dx = 1; dx <= STEP_BURST + 1; dx++ ) {
				yield* walk( dx );
			}

			assert.strictEqual( yield* x, STEP_BURST );

			yield* TestClock.adjust( MIN_STEP_INTERVAL );
			yield* walk( STEP_BURST + 1 );
			yield* walk( STEP_BURST + 2 );
			assert.strictEqual( yield* x, STEP_BURST + 1 );
		} ).pipe( Effect.scoped, Effect.provide( WorldPresenceLive ) )
	);

	it.effect( "derives the room from where the avatar stands", () => Effect.gen( function* () {
		const presence = yield* WorldPresence;
		const alice = yield* presence.join( user( "alice" ) );
		const { room, steps } = pathIntoFirstRoom();

		for ( const pos of steps ) {
			yield* TestClock.adjust( MIN_STEP_INTERVAL );
			yield* presence.handle( alice.self.connId, MoveEvent.make( { pos, facing: "up" } ) );
		}

		const [ me ] = yield* presence.avatars;
		assert.deepStrictEqual( me!.pos, steps.at( -1 ) );
		assert.strictEqual( me!.room, room.game );

	} ).pipe( Effect.scoped, Effect.provide( WorldPresenceLive ) ) );

	it.effect( "announces status, speech and leaving", () => Effect.gen( function* () {
		const presence = yield* WorldPresence;
		const alice = yield* presence.join( user( "alice" ) );
		const bob = yield* presence.join( user( "bob" ) );
		yield* PubSub.take( alice.events );
		yield* PubSub.take( alice.events );

		yield* presence.handle( bob.self.connId, SetStatusEvent.make( { status: "playing" } ) );
		yield* presence.handle( bob.self.connId, SayEvent.make( { text: "   " } ) );
		yield* presence.handle( bob.self.connId, SayEvent.make( { text: " hi " } ) );
		yield* presence.leave( bob.self.connId );
		yield* presence.leave( bob.self.connId );

		assert.deepStrictEqual(
			yield* PubSub.take( alice.events ),
			StatusChangedEvent.make( { connId: bob.self.connId, status: "playing" } )
		);

		assert.deepStrictEqual(
			yield* PubSub.take( alice.events ),
			SaidEvent.make( { connId: bob.self.connId, text: "hi" } )
		);

		assert.deepStrictEqual(
			yield* PubSub.take( alice.events ),
			LeftEvent.make( { connId: bob.self.connId } )
		);

		assert.deepStrictEqual(
			( yield* presence.avatars ).map( a => a.connId ),
			[ alice.self.connId ]
		);

	} ).pipe( Effect.scoped, Effect.provide( WorldPresenceLive ) ) );

	it.effect( "ignores messages from a connection that has left", () => Effect.gen( function* () {
		const presence = yield* WorldPresence;
		const alice = yield* presence.join( user( "alice" ) );
		yield* presence.leave( alice.self.connId );

		yield* presence.handle( alice.self.connId, MoveEvent.make( { pos: right, facing: "right" } ) );
		yield* presence.handle( alice.self.connId, SetStatusEvent.make( { status: "playing" } ) );
		assert.deepStrictEqual( yield* presence.avatars, [] );

	} ).pipe( Effect.scoped, Effect.provide( WorldPresenceLive ) ) );

} );
