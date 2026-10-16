import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import type * as Scope from "effect/Scope";

import { assert, describe, it } from "@effect/vitest";

import * as Persistence from "effect/persistence/Persistence";
import * as TestClock from "effect/testing/TestClock";

import { User, UserId } from "@/auth/schema";
import type { ServerEvent } from "@/chat/schema";
import {
	CandidateSignal,
	JoinCallEvent,
	LeaveCallEvent,
	MAX_CALL_SIZE,
	SayEvent,
	SendSignalEvent,
	SetMediaEvent
} from "@/chat/schema";
import { ChatHistory, ChatHistoryLive, HISTORY_LIMIT } from "@/chat/server/history";
import { ChatRooms, ChatRoomsLive, MIN_SAY_INTERVAL, SAY_BURST } from "@/chat/server/rooms";


const user = ( name: string ) => User.make( {
	id: UserId.make( Bun.randomUUIDv7() ),
	name,
	username: name,
	avatar: `avatar://${ name }`
} );

const ROOM = "fish:game-1";
const OTHER_ROOM = "fish:game-2";

const candidate = CandidateSignal.make( {
	candidate: "candidate:1 1 udp 1 10.0.0.1 9 typ host",
	sdpMid: "0",
	sdpMLineIndex: 0,
	usernameFragment: null
} );

const ChatLive = ChatRoomsLive.pipe( Layer.provideMerge( ChatHistoryLive ), Layer.provide( Persistence.layerMemory ) );

/** Everything waiting in an inbox, without blocking on an empty one. */
const drain = ( inbox: Queue.Dequeue<ServerEvent> ): Effect.Effect<Array<ServerEvent>> =>
	Queue.clear( inbox );

const tags = ( events: ReadonlyArray<ServerEvent> ) => events.map( event => event._tag );

const run = <A, E>( effect: Effect.Effect<A, E, ChatRooms | ChatHistory | Scope.Scope> ) =>
	effect.pipe( Effect.scoped, Effect.provide( ChatLive ) );


describe( "chat rooms", () => {

	it.effect( "shows a joiner who is already in the room, and tells the room", () => run( Effect.gen( function* () {
		const rooms = yield* ChatRooms;
		const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );
		const bob = yield* rooms.join( ROOM, user( "bob" ), "spectator" );

		assert.deepStrictEqual( alice.others, [] );
		assert.deepStrictEqual( bob.others.map( member => member.connId ), [ alice.self.connId ] );
		assert.deepStrictEqual( tags( yield* drain( alice.inbox ) ), [ "chat/evt/MemberJoined", "chat/evt/MemberJoined" ] );
	} ) ) );

	it.effect( "keeps rooms apart", () => run( Effect.gen( function* () {
		const rooms = yield* ChatRooms;
		const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );
		yield* drain( alice.inbox );

		const bob = yield* rooms.join( OTHER_ROOM, user( "bob" ), "player" );
		yield* rooms.handle( bob.self.connId, SayEvent.make( { text: "hello" } ) );

		assert.deepStrictEqual( yield* drain( alice.inbox ), [] );
		assert.deepStrictEqual( bob.others, [] );
	} ) ) );

	it.effect( "tells the room when somebody leaves", () => run( Effect.gen( function* () {
		const rooms = yield* ChatRooms;
		const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );
		const bob = yield* rooms.join( ROOM, user( "bob" ), "player" );
		yield* drain( alice.inbox );

		yield* rooms.leave( bob.self.connId );
		const events = yield* drain( alice.inbox );
		assert.deepStrictEqual( events, [ { _tag: "chat/evt/MemberLeft", connId: bob.self.connId } ] );
		assert.strictEqual( ( yield* rooms.members( ROOM ) ).length, 1 );
	} ) ) );

	describe( "messages", () => {

		it.effect( "broadcasts trimmed text to everybody, spectators included", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );
			const bob = yield* rooms.join( ROOM, user( "bob" ), "spectator" );
			yield* drain( alice.inbox );
			yield* drain( bob.inbox );

			yield* rooms.handle( bob.self.connId, SayEvent.make( { text: "  good luck  " } ) );

			for ( const inbox of [ alice.inbox, bob.inbox ] ) {
				const [ event ] = yield* drain( inbox );
				assert.strictEqual( event?._tag, "chat/evt/Message" );
				assert.strictEqual( event?._tag === "chat/evt/Message" && event.message.text, "good luck" );
			}
		} ) ) );

		it.effect( "drops an empty message", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );
			yield* drain( alice.inbox );

			yield* rooms.handle( alice.self.connId, SayEvent.make( { text: "   " } ) );
			assert.deepStrictEqual( yield* drain( alice.inbox ), [] );
		} ) ) );

		it.effect( "refuses a message over the pace limit, then lets one through", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );
			yield* drain( alice.inbox );

			for ( let i = 0; i <= SAY_BURST; i++ ) {
				yield* rooms.handle( alice.self.connId, SayEvent.make( { text: `m${ i }` } ) );
			}
			const burst = tags( yield* drain( alice.inbox ) );
			assert.strictEqual( burst.filter( tag => tag === "chat/evt/Message" ).length, SAY_BURST );
			assert.strictEqual( burst.at( -1 ), "chat/evt/Refused" );

			yield* TestClock.adjust( MIN_SAY_INTERVAL );
			yield* rooms.handle( alice.self.connId, SayEvent.make( { text: "again" } ) );
			assert.deepStrictEqual( tags( yield* drain( alice.inbox ) ), [ "chat/evt/Message" ] );
		} ) ) );

		it.effect( "keeps the backlog, capped at the most recent", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const history = yield* ChatHistory;
			const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );

			for ( let i = 0; i < HISTORY_LIMIT + 5; i++ ) {
				yield* TestClock.adjust( MIN_SAY_INTERVAL );
				yield* rooms.handle( alice.self.connId, SayEvent.make( { text: `m${ i }` } ) );
			}

			const kept = yield* history.read( ROOM );
			assert.strictEqual( kept.length, HISTORY_LIMIT );
			assert.strictEqual( kept[ 0 ]?.text, "m5" );
			assert.strictEqual( kept.at( -1 )?.text, `m${ HISTORY_LIMIT + 4 }` );
			assert.deepStrictEqual( yield* history.read( OTHER_ROOM ), [] );
		} ) ) );
	} );

	describe( "the call", () => {

		it.effect( "lets a player join, and tells the room", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );
			const bob = yield* rooms.join( ROOM, user( "bob" ), "spectator" );
			yield* drain( bob.inbox );

			yield* rooms.handle( alice.self.connId, JoinCallEvent.make( { audio: true, video: false } ) );
			const [ event ] = yield* drain( bob.inbox );
			assert.strictEqual( event?._tag, "chat/evt/MemberUpdated" );
			assert.deepStrictEqual(
				event?._tag === "chat/evt/MemberUpdated" && [ event.member.inCall, event.member.audio, event.member.video ],
				[ true, true, false ]
			);
		} ) ) );

		it.effect( "refuses a spectator", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const bob = yield* rooms.join( ROOM, user( "bob" ), "spectator" );
			yield* drain( bob.inbox );

			yield* rooms.handle( bob.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );
			assert.deepStrictEqual( yield* drain( bob.inbox ), [ { _tag: "chat/evt/Refused", reason: "not-a-player" } ] );
		} ) ) );

		it.effect( "lets a spectator in once they are seated", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const bob = yield* rooms.join( ROOM, user( "bob" ), "spectator" );
			yield* rooms.setRole( bob.self.connId, "player" );
			yield* drain( bob.inbox );

			yield* rooms.handle( bob.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );
			const [ member ] = yield* rooms.members( ROOM );
			assert.isTrue( member?.inCall );
		} ) ) );

		it.effect( "refuses one more than the limit", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			for ( let i = 0; i < MAX_CALL_SIZE; i++ ) {
				const seat = yield* rooms.join( ROOM, user( `p${ i }` ), "player" );
				yield* rooms.handle( seat.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );
			}

			const late = yield* rooms.join( ROOM, user( "late" ), "player" );
			yield* drain( late.inbox );
			yield* rooms.handle( late.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );
			assert.deepStrictEqual( yield* drain( late.inbox ), [ { _tag: "chat/evt/Refused", reason: "call-full" } ] );
		} ) ) );

		it.effect( "moves a user's call to the tab that joined last", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const alice = user( "alice" );
			const first = yield* rooms.join( ROOM, alice, "player" );
			const second = yield* rooms.join( ROOM, alice, "player" );

			yield* rooms.handle( first.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );
			yield* drain( first.inbox );
			yield* rooms.handle( second.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );

			assert.include( tags( yield* drain( first.inbox ) ), "chat/evt/Refused" );
			const members = yield* rooms.members( ROOM );
			const inCall = members.filter( member => member.inCall ).map( member => member.connId );
			assert.deepStrictEqual( inCall, [ second.self.connId ] );
		} ) ) );

		it.effect( "changes media only while in the call, and leaves it", () => run( Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );

			yield* rooms.handle( alice.self.connId, SetMediaEvent.make( { audio: true, video: true } ) );
			assert.isFalse( ( yield* rooms.members( ROOM ) )[ 0 ]?.audio );

			yield* rooms.handle( alice.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );
			yield* rooms.handle( alice.self.connId, SetMediaEvent.make( { audio: false, video: true } ) );
			assert.isFalse( ( yield* rooms.members( ROOM ) )[ 0 ]?.audio );

			yield* rooms.handle( alice.self.connId, LeaveCallEvent.make( {} ) );
			const [ member ] = yield* rooms.members( ROOM );
			assert.deepStrictEqual( [ member?.inCall, member?.video ], [ false, false ] );
		} ) ) );
	} );

	describe( "signaling", () => {

		const twoInCall = Effect.gen( function* () {
			const rooms = yield* ChatRooms;
			const alice = yield* rooms.join( ROOM, user( "alice" ), "player" );
			const bob = yield* rooms.join( ROOM, user( "bob" ), "player" );
			const carol = yield* rooms.join( ROOM, user( "carol" ), "player" );
			yield* rooms.handle( alice.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );
			yield* rooms.handle( bob.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );
			yield* Effect.forEach( [ alice, bob, carol ], seat => drain( seat.inbox ) );
			return { rooms, alice, bob, carol };
		} );

		it.effect( "delivers to the addressee only", () => run( Effect.gen( function* () {
			const { rooms, alice, bob, carol } = yield* twoInCall;

			yield* rooms.handle( alice.self.connId, SendSignalEvent.make( { to: bob.self.connId, payload: candidate } ) );

			assert.deepStrictEqual( yield* drain( bob.inbox ), [
				{ _tag: "chat/evt/Signal", from: alice.self.connId, payload: candidate }
			] );
			assert.deepStrictEqual( yield* drain( carol.inbox ), [] );
			assert.deepStrictEqual( yield* drain( alice.inbox ), [] );
		} ) ) );

		it.effect( "drops a signal to or from somebody outside the call", () => run( Effect.gen( function* () {
			const { rooms, alice, bob, carol } = yield* twoInCall;

			yield* rooms.handle( alice.self.connId, SendSignalEvent.make( { to: carol.self.connId, payload: candidate } ) );
			yield* rooms.handle( carol.self.connId, SendSignalEvent.make( { to: bob.self.connId, payload: candidate } ) );

			assert.deepStrictEqual( yield* drain( carol.inbox ), [] );
			assert.deepStrictEqual( yield* drain( bob.inbox ), [] );
		} ) ) );

		it.effect( "drops a signal across rooms", () => run( Effect.gen( function* () {
			const { rooms, bob } = yield* twoInCall;
			const mallory = yield* rooms.join( OTHER_ROOM, user( "mallory" ), "player" );
			yield* rooms.handle( mallory.self.connId, JoinCallEvent.make( { audio: true, video: true } ) );

			yield* rooms.handle( mallory.self.connId, SendSignalEvent.make( { to: bob.self.connId, payload: candidate } ) );
			assert.deepStrictEqual( yield* drain( bob.inbox ), [] );
		} ) ) );
	} );
} );
