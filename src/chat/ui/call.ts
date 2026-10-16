import { useEffect, useState, useSyncExternalStore } from "react";

import type { IceServer, SignalPayload } from "@/chat/schema";
import { CandidateSignal, DescriptionSignal } from "@/chat/schema";
import type { ChatConnection, ChatState, Media } from "@/chat/ui/connection";


/**
 * The camera asked for. Small on purpose: in a mesh every browser uploads its
 * camera once per peer, so a call of five uploads four copies.
 */
const VIDEO: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } };

/** Per-peer upload cap, and the lower one once the call is big enough to strain an uplink. */
const BITRATE = 300_000;
const BITRATE_CROWDED = 150_000;
const CROWDED_AT = 3;

export type CallPhase = "idle" | "starting" | "live";

export type CallState = {
	readonly phase: CallPhase;
	readonly local: MediaStream | undefined;
	/** Remote media by the peer's connection id. */
	readonly remotes: ReadonlyMap<string, MediaStream>;
	readonly media: Media;
	/** Whether this device has a camera to turn on at all. */
	readonly hasCamera: boolean;
	readonly error: string | undefined;
};

const IDLE: CallState = {
	phase: "idle",
	local: undefined,
	remotes: new Map(),
	media: { audio: false, video: false },
	hasCamera: true,
	error: undefined
};

type Peer = {
	readonly pc: RTCPeerConnection;
	readonly polite: boolean;
	readonly stream: MediaStream;
	makingOffer: boolean;
	ignoreOffer: boolean;
};

/**
 * This tab's side of a table's call: the camera and microphone, and one
 * `RTCPeerConnection` to everybody else in the call.
 *
 * A full mesh. The server relays signaling and never sees media, so there is
 * nothing to run beyond the chat socket and, for the pairs NAT keeps apart, a
 * TURN relay.
 *
 * Negotiation is the "perfect negotiation" pattern from the WebRTC spec. Both
 * ends of a pair create their connection as soon as each sees the other in
 * the call, both add tracks, and both may offer at once. Glare is resolved by
 * one fixed rule both sides agree on without talking: the end with the smaller
 * connection id is polite and rolls back its own offer; the other ignores the
 * colliding one. Nothing else needs coordinating, so who joined first never
 * matters.
 *
 * Who should be connected is not decided here. `sync` is handed the room as
 * the server last described it, and this makes the connections match: one for
 * every other member in the call, none for anybody who is not. A reconnect
 * arrives as a new id for this tab, and every connection is rebuilt.
 *
 * Muting and turning the camera off flip `track.enabled` rather than removing
 * tracks, so they never renegotiate and take effect at once on every peer.
 */
export class CallSession {
	private state: CallState = IDLE;
	private readonly listeners = new Set<() => void>();
	private readonly peers = new Map<string, Peer>();
	private selfId: string | undefined;
	private iceServers: ReadonlyArray<IceServer> = [];

	constructor( private readonly connection: ChatConnection ) {}

	readonly subscribe = ( listener: () => void ) => {
		this.listeners.add( listener );
		return () => this.listeners.delete( listener );
	};

	readonly getState = () => this.state;

	/**
	 * Asks for the camera and microphone, then joins the call. A refused or
	 * missing camera falls back to audio only; a refused microphone as well
	 * leaves the tab out of the call with the reason in `error`.
	 */
	readonly start = async ( wanted: Media ) => {
		if ( this.state.phase !== "idle" ) {
			return;
		}
		this.set( { phase: "starting", error: undefined } );

		let local: MediaStream;
		let hasCamera = true;
		try {
			local = await navigator.mediaDevices.getUserMedia( { audio: true, video: VIDEO } );
		} catch {
			hasCamera = false;
			try {
				local = await navigator.mediaDevices.getUserMedia( { audio: true } );
			} catch ( error ) {
				this.set( { phase: "idle", error: describe( error ) } );
				return;
			}
		}

		// The page may have left the call, or been torn down, while the browser
		// was asking for permission.
		if ( this.getState().phase !== "starting" ) {
			stopAll( local );
			return;
		}

		const media = { audio: wanted.audio, video: wanted.video && hasCamera };
		applyMedia( local, media );
		this.set( { phase: "live", local, media, hasCamera } );
		this.connection.joinCall( media );
	};

	readonly stop = () => {
		const wasLive = this.state.phase !== "idle";
		for ( const connId of this.peers.keys() ) {
			this.drop( connId );
		}
		if ( this.state.local ) {
			stopAll( this.state.local );
		}
		this.set( { ...IDLE, hasCamera: this.state.hasCamera } );
		if ( wasLive ) {
			this.connection.leaveCall();
		}
	};

	readonly setMedia = ( media: Media ) => {
		if ( !this.state.local ) {
			return;
		}
		const next = { audio: media.audio, video: media.video && this.state.hasCamera };
		applyMedia( this.state.local, next );
		this.set( { media: next } );
		this.connection.setMedia( next );
	};

	/** Leaves the call without telling the server, which already took this tab out of it. */
	readonly release = () => {
		for ( const connId of this.peers.keys() ) {
			this.drop( connId );
		}
		if ( this.state.local ) {
			stopAll( this.state.local );
		}
		this.set( { ...IDLE, hasCamera: this.state.hasCamera } );
	};

	/** Makes the peer connections match the room the server last described. */
	readonly sync = ( chat: ChatState ) => {
		this.iceServers = chat.iceServers;

		if ( chat.self?.connId !== this.selfId ) {
			// A new connection id is a reconnect: everybody is somebody new.
			for ( const connId of this.peers.keys() ) {
				this.drop( connId );
			}
			this.selfId = chat.self?.connId;
		}

		const live = this.state.phase === "live" && chat.self?.inCall === true;
		const wanted = new Set<string>();
		if ( live ) {
			for ( const member of chat.members.values() ) {
				if ( member.inCall ) {
					wanted.add( member.connId );
				}
			}
		}

		for ( const connId of this.peers.keys() ) {
			if ( !wanted.has( connId ) ) {
				this.drop( connId );
			}
		}
		for ( const connId of wanted ) {
			if ( !this.peers.has( connId ) ) {
				this.connect( connId );
			}
		}
		this.capBitrates();
	};

	readonly receive = async ( from: string, payload: SignalPayload ) => {
		const peer = this.peers.get( from );
		if ( !peer ) {
			// Somebody this tab does not consider in the call yet. Their
			// `MemberUpdated` was delivered before any signal of theirs, so this
			// is a peer that already left, or a tab that is not in the call.
			return;
		}

		const { pc } = peer;
		try {
			if ( payload._tag === "chat/sig/Description" ) {
				const collision = payload.type === "offer"
					&& ( peer.makingOffer || pc.signalingState !== "stable" );
				peer.ignoreOffer = !peer.polite && collision;
				if ( peer.ignoreOffer ) {
					return;
				}

				await pc.setRemoteDescription( { type: payload.type, sdp: payload.sdp } );
				if ( payload.type === "offer" ) {
					await pc.setLocalDescription();
					this.sendDescription( from, pc );
				}
				return;
			}

			try {
				await pc.addIceCandidate( {
					candidate: payload.candidate,
					sdpMid: payload.sdpMid,
					sdpMLineIndex: payload.sdpMLineIndex,
					usernameFragment: payload.usernameFragment
				} );
			} catch ( error ) {
				// A candidate for an offer this end chose to ignore is expected to fail.
				if ( !peer.ignoreOffer ) {
					throw error;
				}
			}
		} catch ( error ) {
			console.warn( "chat: signaling failed", from, error );
		}
	};

	private connect( connId: string ) {
		const pc = new RTCPeerConnection( { iceServers: this.iceServers.map( server => ( { ...server, urls: [ ...server.urls ] } ) ) } );
		const peer: Peer = {
			pc,
			polite: ( this.selfId ?? "" ) < connId,
			stream: new MediaStream(),
			makingOffer: false,
			ignoreOffer: false
		};
		this.peers.set( connId, peer );

		const local = this.state.local;
		if ( local ) {
			for ( const track of local.getTracks() ) {
				pc.addTrack( track, local );
			}
		}

		pc.ontrack = ( { track } ) => {
			peer.stream.addTrack( track );
			track.addEventListener( "ended", () => peer.stream.removeTrack( track ) );
			this.publishRemotes();
		};

		pc.onicecandidate = ( { candidate } ) => {
			if ( candidate ) {
				const init = candidate.toJSON();
				this.connection.signal( connId, CandidateSignal.make( {
					candidate: init.candidate ?? "",
					sdpMid: init.sdpMid ?? null,
					sdpMLineIndex: init.sdpMLineIndex ?? null,
					usernameFragment: init.usernameFragment ?? null
				} ) );
			}
		};

		pc.onnegotiationneeded = async () => {
			try {
				peer.makingOffer = true;
				await pc.setLocalDescription();
				this.sendDescription( connId, pc );
			} catch ( error ) {
				console.warn( "chat: could not offer", connId, error );
			} finally {
				peer.makingOffer = false;
			}
		};

		pc.oniceconnectionstatechange = () => {
			if ( pc.iceConnectionState === "failed" ) {
				pc.restartIce();
			}
		};

		pc.onconnectionstatechange = () => {
			if ( pc.connectionState === "connected" ) {
				this.capBitrates();
			}
		};

		this.publishRemotes();
	}

	private drop( connId: string ) {
		const peer = this.peers.get( connId );
		if ( !peer ) {
			return;
		}
		this.peers.delete( connId );
		peer.pc.ontrack = null;
		peer.pc.onicecandidate = null;
		peer.pc.onnegotiationneeded = null;
		peer.pc.oniceconnectionstatechange = null;
		peer.pc.onconnectionstatechange = null;
		peer.pc.close();
		this.publishRemotes();
	}

	private sendDescription( to: string, pc: RTCPeerConnection ) {
		const description = pc.localDescription;
		if ( description && ( description.type === "offer" || description.type === "answer" ) ) {
			this.connection.signal( to, DescriptionSignal.make( { type: description.type, sdp: description.sdp } ) );
		}
	}

	/**
	 * Caps what this tab uploads to each peer. Applied again whenever the call
	 * grows or shrinks, and when a connection comes up — before that a sender
	 * may have no encodings to set.
	 */
	private capBitrates() {
		const maxBitrate = this.peers.size >= CROWDED_AT ? BITRATE_CROWDED : BITRATE;
		for ( const { pc } of this.peers.values() ) {
			for ( const sender of pc.getSenders() ) {
				if ( sender.track?.kind !== "video" ) {
					continue;
				}
				const parameters = sender.getParameters();
				if ( !parameters.encodings?.length ) {
					continue;
				}
				for ( const encoding of parameters.encodings ) {
					encoding.maxBitrate = maxBitrate;
				}
				sender.setParameters( parameters ).catch( () => undefined );
			}
		}
	}

	private publishRemotes() {
		this.set( { remotes: new Map( [ ...this.peers ].map( ( [ connId, peer ] ) => [ connId, peer.stream ] ) ) } );
	}

	private set( next: Partial<CallState> ) {
		this.state = { ...this.state, ...next };
		for ( const listener of this.listeners ) {
			listener();
		}
	}
}

const stopAll = ( stream: MediaStream ) => {
	for ( const track of stream.getTracks() ) {
		track.stop();
	}
};

const applyMedia = ( stream: MediaStream, media: Media ) => {
	for ( const track of stream.getAudioTracks() ) {
		track.enabled = media.audio;
	}
	for ( const track of stream.getVideoTracks() ) {
		track.enabled = media.video;
	}
};

const describe = ( error: unknown ) => {
	if ( error instanceof DOMException ) {
		if ( error.name === "NotAllowedError" ) {
			return "Microphone access was blocked. Allow it in the browser to join the call.";
		}
		if ( error.name === "NotFoundError" ) {
			return "No microphone was found on this device.";
		}
	}
	return "Could not start the microphone.";
};

/**
 * This tab's call for one chat connection, kept in step with the room.
 *
 * Owns the `CallSession` for as long as the connection lives, feeds it every
 * change to the room and every signal, and lets go of the camera on unmount.
 * A refusal that took this tab out of the call — another tab joined, or the
 * call was full — releases the camera without telling the server again.
 */
export function useCall( connection: ChatConnection | undefined, chat: ChatState ) {
	const [ session, setSession ] = useState<CallSession>();

	useEffect( () => {
		if ( !connection ) {
			return;
		}
		const next = new CallSession( connection );
		setSession( next );
		const unsubscribe = connection.onSignal( ( from, payload ) => void next.receive( from, payload ) );
		return () => {
			unsubscribe();
			next.stop();
			setSession( undefined );
		};
	}, [ connection ] );

	useEffect( () => {
		session?.sync( chat );
	}, [ session, chat ] );

	useEffect( () => {
		if ( session && chat.refusal && chat.refusal.reason !== "too-fast" ) {
			session.release();
		}
	}, [ session, chat.refusal ] );

	const state = useSyncExternalStore( session?.subscribe ?? noop, session?.getState ?? idle );
	return { session, state };
}

const noop = () => () => {};
const idle = () => IDLE;

