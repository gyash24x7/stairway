import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import type * as Scope from "effect/Scope";
import * as SynchronizedRef from "effect/SynchronizedRef";

import type { User } from "@/auth/schema";
import type { ChatMember, ChatMessage, ChatRole, ClientEvent, RefusalReason, ServerEvent } from "@/chat/schema";
import {
	MAX_CALL_SIZE,
	MemberJoinedEvent,
	MemberLeftEvent,
	MemberUpdatedEvent,
	MessageEvent,
	RefusedEvent,
	SignalEvent
} from "@/chat/schema";
import { ChatHistory } from "@/chat/server/history";


/**
 * The pace limit on messages: on average one per `MIN_SAY_INTERVAL`
 * milliseconds per connection, with up to `SAY_BURST` back to back. The same
 * token bucket the world uses for steps, sized for typing rather than walking.
 */
export const MIN_SAY_INTERVAL = 500;
export const SAY_BURST = 5;

/**
 * How far a connection's inbox may fall behind before its oldest frames are
 * dropped. Sliding, as on the world's PubSub, so a client that stops reading
 * can never hold up anybody else. A client this far behind is dead, and the
 * heartbeat watchdog is about to close it anyway.
 */
const INBOX_CAPACITY = 1024;

/** A table's room: `<game>:<gameId>`. */
export const roomKey = ( game: string, gameId: string ) => `${ game }:${ gameId }`;

export type Connection = {
	readonly self: ChatMember;
	readonly others: ReadonlyArray<ChatMember>;
	/** Every frame addressed to this connection, its own `MemberJoined` included. */
	readonly inbox: Queue.Dequeue<ServerEvent>;
};

type Entry = {
	readonly room: string;
	readonly member: ChatMember;
	readonly inbox: Queue.Queue<ServerEvent>;
	/** The message bucket: how many may be sent right now, as of `refilledAt`. */
	readonly tokens: number;
	readonly refilledAt: number;
};

type Entries = HashMap.HashMap<string, Entry>;
type Delivery = readonly [ Queue.Queue<ServerEvent>, ServerEvent ];

/**
 * Who is in each table's chat, and who is in its call.
 *
 * Kept in memory and nowhere else, for the same reasons `WorldPresence` is: a
 * restart drops every socket, each client reconnects and is sent a fresh
 * `Snapshot`, and nothing is lost that a reconnect does not rebuild. The text
 * backlog is the exception and lives in `ChatHistory`.
 *
 * It lives on one process, the way `SingleRunner` keeps every game on one
 * process. Running more than one server would need the inboxes fed from Redis
 * instead.
 *
 * Every change runs through one `SynchronizedRef`, and the frames a change
 * produces are delivered before the next change starts. A member is always sent
 * whole (`MemberUpdated`), so out-of-order delivery would leave a client showing
 * an older state than the server holds; serializing here is what rules that out.
 * Nothing slow happens inside — offers to sliding queues never wait — and the
 * history write for a message happens after its broadcast, outside the lock.
 *
 * Who may do what:
 * - Anybody in the room may post.
 * - Only a `player` may join the call, change their media or send signaling,
 * 		and only to somebody else in the same call. That keeps the relay from
 * 		being a way to reach an arbitrary connection.
 * - A role is set at join, and again by `setRole`, which the socket calls with
 * 		a fresh answer from the game before every `JoinCall`.
 */
export class ChatRooms extends Context.Service<ChatRooms, {
	/** Adds a connection to `room`. Its inbox closes with the caller's scope. */
	readonly join: (
		room: string,
		user: User,
		role: ChatRole
	) => Effect.Effect<Connection, never, Scope.Scope>;
	readonly leave: ( connId: string ) => Effect.Effect<void>;
	readonly setRole: ( connId: string, role: ChatRole ) => Effect.Effect<void>;
	readonly handle: ( connId: string, message: ClientEvent ) => Effect.Effect<void>;
	/** The members of `room`, for tests and diagnostics. */
	readonly members: ( room: string ) => Effect.Effect<ReadonlyArray<ChatMember>>;
}>()( "chat/ChatRooms" ) {}

const inRoom = ( entries: Entries, room: string ) =>
	Array.from( HashMap.values( entries ) ).filter( entry => entry.room === room );

const toAll = ( entries: Entries, room: string, event: ServerEvent ): Array<Delivery> =>
	inRoom( entries, room ).map( entry => [ entry.inbox, event ] as const );

const refuse = ( entry: Entry, reason: RefusalReason ): Delivery =>
	[ entry.inbox, RefusedEvent.make( { reason } ) ];

const outOfCall = ( member: ChatMember ): ChatMember =>
	( { ...member, inCall: false, audio: false, video: false } );

export const ChatRoomsLive = Layer.effect(
	ChatRooms,
	Effect.gen( function* () {
		const history = yield* ChatHistory;
		const state = yield* SynchronizedRef.make<Entries>( HashMap.empty() );
		const counter = yield* Ref.make( 0 );

		/**
		 * Applies one change and delivers what it produced, before any other
		 * change can start.
		 */
		const commit = <A>( f: ( entries: Entries ) => readonly [ A, Entries, ReadonlyArray<Delivery> ] ) =>
			SynchronizedRef.modifyEffect( state, entries => {
				const [ result, next, deliveries ] = f( entries );
				return Effect.forEach(
					deliveries,
					( [ inbox, event ] ) => Queue.offer( inbox, event ),
					{ discard: true }
				).pipe( Effect.as( [ result, next ] as const ) );
			} );

		/** Replaces one member and tells their room, when they are still here. */
		const update = ( entries: Entries, entry: Entry, member: ChatMember, extra: ReadonlyArray<Delivery> = [] ) => {
			const next = HashMap.set( entries, member.connId, { ...entry, member } );
			return [
				next,
				[ ...extra, ...toAll( next, entry.room, MemberUpdatedEvent.make( { member } ) ) ]
			] as const;
		};

		const join = Effect.fnUntraced( function* ( room: string, user: User, role: ChatRole ) {
			const inbox = yield* Queue.sliding<ServerEvent>( INBOX_CAPACITY );
			yield* Effect.addFinalizer( () => Queue.shutdown( inbox ) );

			const connId = `k${ yield* Ref.updateAndGet( counter, n => n + 1 ) }`;
			const self: ChatMember = {
				connId,
				userId: user.id,
				name: user.name,
				avatar: user.avatar,
				role,
				inCall: false,
				audio: false,
				video: false
			};

			const others = yield* commit( entries => {
				const others = inRoom( entries, room ).map( entry => entry.member );
				const next = HashMap.set( entries, connId, {
					room,
					member: self,
					inbox,
					tokens: SAY_BURST,
					refilledAt: 0
				} );
				return [ others, next, toAll( next, room, MemberJoinedEvent.make( { member: self } ) ) ] as const;
			} );

			return { self, others, inbox } satisfies Connection;
		} );

		const leave = ( connId: string ) => commit( entries => {
			const entry = Option.getOrUndefined( HashMap.get( entries, connId ) );
			if ( !entry ) {
				return [ undefined, entries, [] ] as const;
			}

			const next = HashMap.remove( entries, connId );
			return [ undefined, next, toAll( next, entry.room, MemberLeftEvent.make( { connId } ) ) ] as const;
		} );

		/**
		 * Records a fresh answer about who somebody is. A player who is no longer
		 * one — the only way that happens is a game they were removed from — is
		 * taken out of the call along with it.
		 */
		const setRole = ( connId: string, role: ChatRole ) => commit( entries => {
			const entry = Option.getOrUndefined( HashMap.get( entries, connId ) );
			if ( !entry || entry.member.role === role ) {
				return [ undefined, entries, [] ] as const;
			}

			const member = role === "player"
				? { ...entry.member, role }
				: { ...outOfCall( entry.member ), role };
			const [ next, deliveries ] = update( entries, entry, member );
			return [ undefined, next, deliveries ] as const;
		} );

		const say = ( connId: string, text: string, now: number ) => commit( entries => {
			const entry = Option.getOrUndefined( HashMap.get( entries, connId ) );
			if ( !entry || text === "" ) {
				return [ undefined, entries, [] ] as const;
			}

			const tokens = Math.min(
				SAY_BURST,
				entry.tokens + ( now - entry.refilledAt ) / MIN_SAY_INTERVAL
			);
			if ( tokens < 1 ) {
				return [ undefined, entries, [ refuse( entry, "too-fast" ) ] ] as const;
			}

			const message: ChatMessage = {
				id: crypto.randomUUID(),
				userId: entry.member.userId,
				name: entry.member.name,
				avatar: entry.member.avatar,
				text,
				at: now
			};

			const next = HashMap.set( entries, connId, { ...entry, tokens: tokens - 1, refilledAt: now } );
			return [
				{ room: entry.room, message },
				next,
				toAll( next, entry.room, MessageEvent.make( { message } ) )
			] as const;
		} );

		/**
		 * Joins the call, or refuses to. The same user already in the call from
		 * another tab is taken out of it first, and does not count towards the
		 * limit: they are being replaced, not joined.
		 */
		const joinCall = ( connId: string, audio: boolean, video: boolean ) => commit( entries => {
			const entry = Option.getOrUndefined( HashMap.get( entries, connId ) );
			if ( !entry ) {
				return [ undefined, entries, [] ] as const;
			}

			if ( entry.member.role !== "player" ) {
				return [ undefined, entries, [ refuse( entry, "not-a-player" ) ] ] as const;
			}

			const room = inRoom( entries, entry.room );
			const elsewhere = room.filter( other =>
				other.member.connId !== connId
				&& other.member.userId === entry.member.userId
				&& other.member.inCall );
			const inCall = room.filter( other =>
				other.member.inCall
				&& other.member.connId !== connId
				&& other.member.userId !== entry.member.userId );

			if ( inCall.length >= MAX_CALL_SIZE ) {
				return [ undefined, entries, [ refuse( entry, "call-full" ) ] ] as const;
			}

			let next = entries;
			const deliveries: Array<Delivery> = [];
			for ( const other of elsewhere ) {
				const [ after, sent ] = update( next, other, outOfCall( other.member ), [ refuse( other, "joined-elsewhere" ) ] );
				next = after;
				deliveries.push( ...sent );
			}

			const [ after, sent ] = update( next, entry, { ...entry.member, inCall: true, audio, video } );
			return [ undefined, after, [ ...deliveries, ...sent ] ] as const;
		} );

		const inCallOnly = ( connId: string, f: ( member: ChatMember ) => ChatMember ) => commit( entries => {
			const entry = Option.getOrUndefined( HashMap.get( entries, connId ) );
			if ( !entry || !entry.member.inCall ) {
				return [ undefined, entries, [] ] as const;
			}

			const [ next, deliveries ] = update( entries, entry, f( entry.member ) );
			return [ undefined, next, deliveries ] as const;
		} );

		const signal = ( connId: string, message: Extract<ClientEvent, { _tag: "chat/evt/SendSignal" }> ) =>
			commit( entries => {
				const from = Option.getOrUndefined( HashMap.get( entries, connId ) );
				const to = Option.getOrUndefined( HashMap.get( entries, message.to ) );
				const allowed = from !== undefined
					&& to !== undefined
					&& from.room === to.room
					&& from.member.connId !== to.member.connId
					&& from.member.inCall
					&& to.member.inCall;

				return [
					undefined,
					entries,
					allowed ? [ [ to.inbox, SignalEvent.make( { from: connId, payload: message.payload } ) ] as const ] : []
				] as const;
			} );

		const handle = Effect.fnUntraced( function* ( connId: string, message: ClientEvent ) {
			switch ( message._tag ) {
				case "chat/evt/Say": {
					const now = yield* Clock.currentTimeMillis;
					const said = yield* say( connId, message.text.trim(), now );
					if ( said ) {
						yield* history.append( said.room, said.message );
					}
					return;
				}

				case "chat/evt/JoinCall":
					return yield* joinCall( connId, message.audio, message.video );

				case "chat/evt/LeaveCall":
					return yield* inCallOnly( connId, outOfCall );

				case "chat/evt/SetMedia":
					return yield* inCallOnly(
						connId,
						member => ( { ...member, audio: message.audio, video: message.video } )
					);

				case "chat/evt/SendSignal":
					return yield* signal( connId, message );

				case "chat/evt/Pong":
					// Liveness only, read by the socket's watchdog.
					return;
			}
		} );

		const members = ( room: string ) => SynchronizedRef.get( state ).pipe(
			Effect.map( entries => inRoom( entries, room ).map( entry => entry.member ) )
		);

		return ChatRooms.of( { join, leave, setRole, handle, members } );
	} )
);
