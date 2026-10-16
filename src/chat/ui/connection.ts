import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { useEffect, useState, useSyncExternalStore } from "react";

import type {
	ChatMember,
	ChatMessage,
	ClientEvent,
	IceServer,
	RefusalReason,
	ServerEvent,
	SignalPayload
} from "@/chat/schema";
import {
	ClientEventJson,
	JoinCallEvent,
	LeaveCallEvent,
	PongEvent,
	SayEvent,
	SendSignalEvent,
	ServerEventJson,
	SetMediaEvent
} from "@/chat/schema";


const decode = Schema.decodeUnknownOption( ServerEventJson );
const encode = Schema.encodeSync( ClientEventJson );

/** The world socket's backoff: quick at first, then every ten seconds, for at most two minutes. */
const RECONNECT_FIRST = 500;
const RECONNECT_CAP = 10_000;
const RECONNECT_BUDGET = 120_000;

/** Two missed heartbeats, as on the world socket. */
const SILENCE_LIMIT = 30_000;
const WATCHDOG_EVERY = 5_000;

export type ChatStatus = "connecting" | "open" | "reconnecting" | "failed";

export type Media = { readonly audio: boolean; readonly video: boolean };

export type ChatState = {
	readonly status: ChatStatus;
	/** Whether a `Snapshot` has ever arrived — false for somebody the table turned away. */
	readonly admitted: boolean;
	readonly self: ChatMember | undefined;
	readonly members: ReadonlyMap<string, ChatMember>;
	readonly messages: ReadonlyArray<ChatMessage>;
	readonly iceServers: ReadonlyArray<IceServer>;
	/** The most recent refusal, with when it arrived so the same one twice still shows twice. */
	readonly refusal: { readonly reason: RefusalReason; readonly at: number } | undefined;
};

const INITIAL: ChatState = {
	status: "connecting",
	admitted: false,
	self: undefined,
	members: new Map(),
	messages: [],
	iceServers: [],
	refusal: undefined
};

type SignalListener = ( from: string, payload: SignalPayload ) => void;

/**
 * One open connection to a table's chat.
 *
 * Built the way `WorldConnection` is — plain state behind
 * `useSyncExternalStore`, a silence watchdog, a capped backoff, and `suspend`
 * for the back/forward cache — for the same reasons: a reconnect has to keep
 * showing the conversation until the new `Snapshot` replaces it.
 *
 * Signaling is not state. It is handed straight to whoever is listening
 * (`onSignal`), which is the call, and never stored.
 *
 * The connection remembers whether this tab wanted to be in the call. A
 * reconnect is a new connection id with nobody in the call, so the wish is
 * re-sent as soon as the new `Snapshot` arrives, and the call rebuilds its peer
 * connections around it.
 *
 * Somebody the table turns away — neither seated nor watching — has their
 * upgrade refused, which looks to the browser like any other closed socket.
 * They are retried on the same backoff, which is also what lets a stranger who
 * goes on to spectate be let in within a few seconds without anything having
 * to tell this connection to try again.
 */
export class ChatConnection {
	private state: ChatState = INITIAL;
	private readonly listeners = new Set<() => void>();
	private readonly signalListeners = new Set<SignalListener>();
	private socket: WebSocket | undefined;
	private closed = false;
	private retryTimer: ReturnType<typeof setTimeout> | undefined;
	private retryDelay = RECONNECT_FIRST;
	private outageStartedAt: number | undefined;
	private lastFrameAt = 0;
	private watchdog: ReturnType<typeof setInterval> | undefined;
	private wantCall: Media | undefined;

	constructor( private readonly url: string ) {
		this.open();
	}

	readonly subscribe = ( listener: () => void ) => {
		this.listeners.add( listener );
		return () => this.listeners.delete( listener );
	};

	readonly getState = () => this.state;

	readonly onSignal = ( listener: SignalListener ) => {
		this.signalListeners.add( listener );
		return () => this.signalListeners.delete( listener );
	};

	/** Lets go of the socket while the page sits in the back/forward cache. */
	readonly suspend = () => {
		clearTimeout( this.retryTimer );
		clearInterval( this.watchdog );
		const socket = this.socket;
		this.socket = undefined;
		socket?.close();
	};

	/** Starts over after the reconnect budget ran out, or after `suspend`. */
	readonly reconnect = () => {
		this.suspend();
		this.outageStartedAt = undefined;
		this.retryDelay = RECONNECT_FIRST;
		this.set( { status: "connecting" } );
		this.open();
	};

	readonly close = () => {
		this.closed = true;
		clearTimeout( this.retryTimer );
		clearInterval( this.watchdog );
		this.socket?.close();
		this.socket = undefined;
	};

	readonly say = ( text: string ) => this.send( SayEvent.make( { text } ) );

	readonly joinCall = ( media: Media ) => {
		this.wantCall = media;
		this.send( JoinCallEvent.make( media ) );
	};

	readonly leaveCall = () => {
		this.wantCall = undefined;
		this.send( LeaveCallEvent.make( {} ) );
	};

	readonly setMedia = ( media: Media ) => {
		if ( this.wantCall ) {
			this.wantCall = media;
		}
		this.send( SetMediaEvent.make( media ) );
	};

	readonly signal = ( to: string, payload: SignalPayload ) =>
		this.send( SendSignalEvent.make( { to, payload } ) );

	private set( next: Partial<ChatState> ) {
		this.state = { ...this.state, ...next };
		for ( const listener of this.listeners ) {
			listener();
		}
	}

	private open() {
		const socket = new WebSocket( this.url );
		this.socket = socket;
		this.lastFrameAt = Date.now();

		// Silence is the only symptom of a connection that died without a
		// `close` — see the same watchdog in `WorldConnection`.
		clearInterval( this.watchdog );
		this.watchdog = setInterval( () => {
			if ( this.socket === socket && Date.now() - this.lastFrameAt > SILENCE_LIMIT ) {
				clearInterval( this.watchdog );
				this.socket = undefined;
				socket.close();
				this.retry();
			}
		}, WATCHDOG_EVERY );

		socket.addEventListener( "message", message => {
			this.lastFrameAt = Date.now();
			const event = decode( message.data );
			if ( Option.isSome( event ) ) {
				this.receive( event.value );
			}
		} );

		socket.addEventListener( "close", () => {
			if ( this.socket === socket ) {
				this.retry();
			}
		} );
	}

	private retry() {
		if ( this.closed ) {
			return;
		}
		const now = Date.now();
		this.outageStartedAt ??= now;
		if ( now - this.outageStartedAt > RECONNECT_BUDGET ) {
			this.set( { status: "failed" } );
			return;
		}

		this.set( { status: "reconnecting" } );
		const delay = this.retryDelay * ( 0.8 + Math.random() * 0.4 );
		this.retryDelay = Math.min( this.retryDelay * 2, RECONNECT_CAP );
		this.retryTimer = setTimeout( () => this.open(), delay );
	}

	private send( message: ClientEvent ) {
		if ( this.socket?.readyState === WebSocket.OPEN ) {
			this.socket.send( encode( message ) );
		}
	}

	private receive( event: ServerEvent ) {
		switch ( event._tag ) {
			case "chat/evt/Snapshot": {
				this.outageStartedAt = undefined;
				this.retryDelay = RECONNECT_FIRST;

				// The backlog replaces what was shown. A message sent while the
				// server was reading it can be both in it and in the inbox behind
				// this frame; `Message` below drops the second copy by id.
				this.set( {
					status: "open",
					admitted: true,
					self: event.self,
					members: new Map( event.members.map( member => [ member.connId, member ] ) ),
					messages: event.messages,
					iceServers: event.iceServers
				} );

				if ( this.wantCall ) {
					this.send( JoinCallEvent.make( this.wantCall ) );
				}
				return;
			}

			case "chat/evt/MemberJoined":
			case "chat/evt/MemberUpdated": {
				if ( event.member.connId === this.state.self?.connId ) {
					this.set( { self: event.member } );
					return;
				}
				const members = new Map( this.state.members );
				members.set( event.member.connId, event.member );
				this.set( { members } );
				return;
			}

			case "chat/evt/MemberLeft": {
				const members = new Map( this.state.members );
				members.delete( event.connId );
				this.set( { members } );
				return;
			}

			case "chat/evt/Message":
				if ( !this.state.messages.some( message => message.id === event.message.id ) ) {
					this.set( { messages: [ ...this.state.messages, event.message ] } );
				}
				return;

			case "chat/evt/Signal":
				for ( const listener of this.signalListeners ) {
					listener( event.from, event.payload );
				}
				return;

			case "chat/evt/Refused":
				if ( event.reason !== "too-fast" ) {
					this.wantCall = undefined;
				}
				this.set( { refusal: { reason: event.reason, at: Date.now() } } );
				return;

			case "chat/evt/Heartbeat":
				this.send( PongEvent.make( {} ) );
				return;
		}
	}
}

const socketUrl = ( game: string, gameId: string ) => {
	const scheme = window.location.protocol === "https:" ? "wss" : "ws";
	const query = new URLSearchParams( { game, gameId } );
	return `${ scheme }://${ window.location.host }/api/chat/socket?${ query.toString() }`;
};

/** Opens the chat for one table, and closes it on unmount or when the table changes. */
export function useChatConnection( game: string | undefined, gameId: string | undefined ) {
	const [ connection, setConnection ] = useState<ChatConnection>();

	useEffect( () => {
		if ( !game || !gameId ) {
			return;
		}
		const next = new ChatConnection( socketUrl( game, gameId ) );
		setConnection( next );

		const onPageHide = () => next.suspend();
		const onPageShow = ( event: PageTransitionEvent ) => {
			if ( event.persisted ) {
				next.reconnect();
			}
		};
		window.addEventListener( "pagehide", onPageHide );
		window.addEventListener( "pageshow", onPageShow );

		return () => {
			window.removeEventListener( "pagehide", onPageHide );
			window.removeEventListener( "pageshow", onPageShow );
			next.close();
			setConnection( undefined );
		};
	}, [ game, gameId ] );

	return connection;
}

const noop = () => () => {};
const initial = () => INITIAL;

export function useChatState( connection: ChatConnection | undefined ): ChatState {
	return useSyncExternalStore(
		connection?.subscribe ?? noop,
		connection?.getState ?? initial
	);
}
