import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { useEffect, useState, useSyncExternalStore } from "react";

import type { Pos } from "@/world/map";
import { samePos } from "@/world/map";
import type { ClientEvent, Facing, Meeple, ServerEvent } from "@/world/schema";
import {
	ClientEventJson,
	MoveEvent,
	PongEvent,
	SayEvent,
	ServerEventJson,
	SetStatusEvent
} from "@/world/schema";


const decode = Schema.decodeUnknownOption( ServerEventJson );
const encode = Schema.encodeSync( ClientEventJson );

/** How long a speech bubble stays over an avatar's head. */
export const BUBBLE_MILLIS = 6_000;

/** Same shape as `withReconnect`: quick at first, then every ten seconds, for at most two minutes. */
const RECONNECT_FIRST = 500;
const RECONNECT_CAP = 10_000;
const RECONNECT_BUDGET = 120_000;

/**
 * How long the socket may go without a single frame before it is treated as
 * dead. The server sends a heartbeat every 10s (`HEARTBEAT_INTERVAL`), so this
 * allows two missed heartbeats before giving up on the connection. It matches
 * the 30s `StallTimeout` a game's SSE stream uses.
 */
const SILENCE_LIMIT = 30_000;
const WATCHDOG_EVERY = 5_000;

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "failed";

export type Bubble = { readonly text: string; readonly until: number };

export type WorldState = {
	readonly status: ConnectionStatus;
	readonly self: Meeple | undefined;
	readonly others: ReadonlyMap<string, Meeple>;
	readonly bubbles: ReadonlyMap<string, Bubble>;
};

const INITIAL: WorldState = {
	status: "connecting",
	self: undefined,
	others: new Map(),
	bubbles: new Map()
};

/**
 * One open connection to the world, with everyone in it as last reported.
 *
 * This is plain state behind `useSyncExternalStore` rather than an atom over an
 * Effect `Stream`, because two things here would not fit an atom well. Walking
 * moves your own avatar before the server has answered. And a reconnect has to
 * keep showing the world as it was until the new `Snapshot` replaces it,
 * instead of dropping back to a loading state. Everything sent over the socket
 * is still decoded with the shared schema.
 *
 * Your own position is predicted. Each step is applied at once and also added
 * to `pending`. The server's `Moved` for you either confirms a pending step,
 * which drops it and everything sent before it, or carries a position that was
 * never predicted. The second case means the server refused a step, so the
 * prediction is thrown away and its position is taken.
 */
export class WorldConnection {
	private state: WorldState = INITIAL;
	private readonly listeners = new Set<() => void>();
	private socket: WebSocket | undefined;
	private pending: Array<Pos> = [];
	private closed = false;
	private retryTimer: ReturnType<typeof setTimeout> | undefined;
	private retryDelay = RECONNECT_FIRST;
	private outageStartedAt: number | undefined;
	private lastFrameAt = 0;
	private watchdog: ReturnType<typeof setInterval> | undefined;

	constructor( private readonly url: string ) {
		this.open();
	}

	readonly subscribe = ( listener: () => void ) => {
		this.listeners.add( listener );
		return () => this.listeners.delete( listener );
	};

	readonly getState = () => this.state;

	/**
	 * Lets go of the socket while the page is hidden away, without closing the
	 * connection for good. `reconnect` picks it up again.
	 *
	 * This is for the back/forward cache. A page that is navigated away from
	 * can be frozen there with its socket still open, and the server goes on
	 * showing its avatar standing in the world until the browser finally
	 * discards the page. Releasing the socket on `pagehide` removes the avatar
	 * as soon as the person leaves.
	 */
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

	/** Steps your avatar to `pos` and tells the server. Returns false if the connection is not ready. */
	readonly step = ( pos: Pos, facing: Facing ) => {
		const self = this.state.self;
		if ( !self || this.state.status !== "open" ) {
			return false;
		}
		this.pending.push( pos );
		this.set( { self: { ...self, pos, facing } } );
		this.send( MoveEvent.make( { pos, facing } ) );
		return true;
	};

	readonly setPlaying = ( playing: boolean ) => {
		const status = playing ? "playing" : "idle";
		if ( this.state.self && this.state.self.status !== status ) {
			this.set( { self: { ...this.state.self, status } } );
			this.send( SetStatusEvent.make( { status } ) );
		}
	};

	readonly say = ( text: string ) => this.send( SayEvent.make( { text } ) );

	private set( next: Partial<WorldState> ) {
		this.state = { ...this.state, ...next };
		for ( const listener of this.listeners ) {
			listener();
		}
	}

	private open() {
		const socket = new WebSocket( this.url );
		this.socket = socket;
		this.lastFrameAt = Date.now();

		// A connection can die without the browser firing `close`: a laptop
		// that slept, a proxy that dropped the route, a network that changed
		// underneath. Silence is the only symptom, so it is watched for here.
		// The socket is abandoned before it is closed, because closing a dead
		// connection can take the browser a long time, and the reconnect should
		// not wait on it. Its own `close` event is ignored when it finally fires,
		// since it is no longer `this.socket`.
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
		const others = new Map( this.state.others );
		const self = this.state.self;

		switch ( event._tag ) {
			case "world/evt/Snapshot": {
				this.pending = [];
				this.outageStartedAt = undefined;
				this.retryDelay = RECONNECT_FIRST;

				// A reconnect gets a new connection id and is placed at the spawn
				// point again. Keep the status the page last reported, since the game
				// overlay may still be open.
				const status = self?.status ?? "idle";
				this.set( {
					status: "open",
					self: { ...event.self, status },
					others: new Map( event.others.map( a => [ a.connId, a ] ) )
				} );

				if ( status !== event.self.status ) {
					this.send( SetStatusEvent.make( { status } ) );
				}

				return;
			}

			case "world/evt/Joined":
				if ( event.avatar.connId !== self?.connId ) {
					others.set( event.avatar.connId, event.avatar );
					this.set( { others } );
				}
				return;

			case "world/evt/Left": {
				others.delete( event.connId );
				const bubbles = new Map( this.state.bubbles );
				bubbles.delete( event.connId );
				this.set( { others, bubbles } );
				return;
			}

			case "world/evt/Moved": {
				if ( self && event.connId === self.connId ) {
					const confirmed = this.pending.findIndex( p => samePos( p, event.pos ) );
					if ( confirmed !== -1 ) {
						this.pending.splice( 0, confirmed + 1 );
						// The room is the server's to say, even for a step we predicted.
						if ( self.room !== event.room ) {
							this.set( { self: { ...self, room: event.room } } );
						}
					} else {
						this.pending = [];
						this.set( {
							self: {
								...self,
								pos: event.pos,
								facing: event.facing,
								room: event.room
							}
						} );
					}

					return;
				}
				const avatar = others.get( event.connId );
				if ( avatar ) {
					others.set(
						event.connId,
						{ ...avatar, pos: event.pos, facing: event.facing, room: event.room }
					);

					this.set( { others } );
				}
				return;
			}

			case "world/evt/StatusChanged": {
				const avatar = others.get( event.connId );
				if ( avatar ) {
					others.set( event.connId, { ...avatar, status: event.status } );
					this.set( { others } );
				}

				return;
			}

			case "world/evt/Said": {
				const bubbles = new Map( this.state.bubbles );
				bubbles.set( event.connId, { text: event.text, until: Date.now() + BUBBLE_MILLIS } );
				this.set( { bubbles } );
				return;
			}

			case "world/evt/Heartbeat":
				// Its arrival already reset `lastFrameAt`. The reply tells the
				// server this page is still running (see `PongEvent`).
				this.send( PongEvent.make( {} ) );
				return;
		}
	}
}

const socketUrl = () => {
	const scheme = window.location.protocol === "https:" ? "wss" : "ws";
	return `${ scheme }://${ window.location.host }/api/world/socket`;
};

/**
 * Opens the world connection while `enabled`, and closes it on unmount or when
 * `enabled` turns false.
 */
export function useWorldConnection( enabled: boolean ) {
	const [ connection, setConnection ] = useState<WorldConnection>();

	useEffect( () => {
		if ( !enabled ) {
			return;
		}
		const next = new WorldConnection( socketUrl() );
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
	}, [ enabled ] );

	return connection;
}

const noop = () => () => {};
const initial = () => INITIAL;

export function useWorldState( connection: WorldConnection | undefined ): WorldState {
	return useSyncExternalStore(
		connection?.subscribe ?? noop,
		connection?.getState ?? initial
	);
}
