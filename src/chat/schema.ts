import * as Schema from "effect/Schema";


/**
 * The table chat's wire protocol. Both directions travel as JSON text frames
 * over one socket per open table, at `/api/chat/socket?game=…&gameId=…`.
 *
 * Like the world's presence, none of this is game state. Nothing here is
 * event-sourced, replayed or archived: who is in the room and who is in the
 * call live in memory, and a reconnecting client is sent a fresh `Snapshot`.
 * The one thing that outlives a connection is the text backlog, kept beside the
 * game in Redis for as long as the game itself is kept there.
 *
 * The server never touches media. Video and audio flow browser to browser over
 * WebRTC, and the socket only carries what two browsers need to find each
 * other — `Signal` — addressed to one connection and never broadcast.
 */

/** Long enough for a sentence or two, short enough to keep the backlog small. */
export const MAX_MESSAGE_LENGTH = 500;

/**
 * How many people may be in one table's call at once.
 *
 * Every browser in a mesh uploads its camera once per peer, so the cost grows
 * with the square of the call. Six is about where a home uplink stops coping
 * with 360p, and it covers every table but a full fish game, where the rest can
 * still talk in text.
 */
export const MAX_CALL_SIZE = 6;

/**
 * - player: holds a seat at the table. May post, and may join the call.
 * - spectator: chose to watch. May post, and may not join the call.
 */
export type ChatRole = typeof ChatRole.Type;
export const ChatRole = Schema.Literals( [ "player", "spectator" ] );

/**
 * One connection in a table's chat.
 *
 * - connId: The connection, not the user, as in the world. Two tabs are two
 * 		members, though only one of them may be in the call (see `JoinCall`).
 * - inCall: Whether this connection has joined the call. Everybody in the call
 * 		holds a peer connection to everybody else in it.
 * - audio / video: Whether the microphone and camera are on. Only meaningful
 * 		while `inCall`. They drive the badges on a tile; muting never renegotiates.
 */
export type ChatMember = typeof ChatMember.Type;
export const ChatMember = Schema.Struct( {
	connId: Schema.String,
	userId: Schema.String,
	name: Schema.String,
	avatar: Schema.String,
	role: ChatRole,
	inCall: Schema.Boolean,
	audio: Schema.Boolean,
	video: Schema.Boolean
} );

export type ChatMessage = typeof ChatMessage.Type;
export const ChatMessage = Schema.Struct( {
	id: Schema.String,
	userId: Schema.String,
	name: Schema.String,
	avatar: Schema.String,
	text: Schema.String,
	at: Schema.Number
} );

/** The shape `RTCIceServer` takes, as far as anything here fills it in. */
export type IceServer = typeof IceServer.Type;
export const IceServer = Schema.Struct( {
	urls: Schema.Array( Schema.String ),
	username: Schema.optional( Schema.String ),
	credential: Schema.optional( Schema.String )
} );


// --- Signaling -------------------------------------------------------------

/** An `RTCSessionDescriptionInit`: an offer or an answer, relayed as is. */
export const DescriptionSignal = Schema.TaggedStruct( "chat/sig/Description", {
	type: Schema.Literals( [ "offer", "answer" ] ),
	sdp: Schema.String
} );

/** An `RTCIceCandidateInit`, trickled as soon as the browser finds it. */
export const CandidateSignal = Schema.TaggedStruct( "chat/sig/Candidate", {
	candidate: Schema.String,
	sdpMid: Schema.NullOr( Schema.String ),
	sdpMLineIndex: Schema.NullOr( Schema.Number ),
	usernameFragment: Schema.NullOr( Schema.String )
} );

export type SignalPayload = typeof SignalPayload.Type;
export const SignalPayload = Schema.Union( [ DescriptionSignal, CandidateSignal ] );


// --- Client → server -------------------------------------------------------

export const SayEvent = Schema.TaggedStruct( "chat/evt/Say", {
	text: Schema.String.check( Schema.isMaxLength( MAX_MESSAGE_LENGTH ) )
} );

/**
 * Join the table's call with the camera and microphone as given.
 *
 * Players only, and re-checked against the game when it arrives rather than
 * trusted from when the socket opened: somebody who was watching may have been
 * seated since. A user is in the call from one tab at a time, so joining from a
 * second tab takes the first one out of it.
 */
export const JoinCallEvent = Schema.TaggedStruct( "chat/evt/JoinCall", {
	audio: Schema.Boolean,
	video: Schema.Boolean
} );

export const LeaveCallEvent = Schema.TaggedStruct( "chat/evt/LeaveCall", {} );

export const SetMediaEvent = Schema.TaggedStruct( "chat/evt/SetMedia", {
	audio: Schema.Boolean,
	video: Schema.Boolean
} );

/** Signaling for one peer. Delivered only if both ends are in the same call. */
export const SendSignalEvent = Schema.TaggedStruct( "chat/evt/SendSignal", {
	to: Schema.String,
	payload: SignalPayload
} );

/** The client's answer to every `HeartbeatEvent`, as on the world socket. */
export const PongEvent = Schema.TaggedStruct( "chat/evt/Pong", {} );

export type ClientEvent = typeof ClientEvent.Type;
export const ClientEvent = Schema.Union( [
	SayEvent,
	JoinCallEvent,
	LeaveCallEvent,
	SetMediaEvent,
	SendSignalEvent,
	PongEvent
] );

export const ClientEventJson = Schema.fromJsonString( ClientEvent );


// --- Server → client -------------------------------------------------------

/**
 * The first frame on every connection: who you are, who else is here, the
 * backlog, and the ICE servers to build peer connections with.
 */
export const SnapshotEvent = Schema.TaggedStruct( "chat/evt/Snapshot", {
	self: ChatMember,
	members: Schema.Array( ChatMember ),
	messages: Schema.Array( ChatMessage ),
	iceServers: Schema.Array( IceServer )
} );

export const MemberJoinedEvent = Schema.TaggedStruct( "chat/evt/MemberJoined", {
	member: ChatMember
} );

export const MemberLeftEvent = Schema.TaggedStruct( "chat/evt/MemberLeft", {
	connId: Schema.String
} );

/**
 * A member as they now are — joined or left the call, muted, turned the camera
 * off, or was seated. The whole member rather than what changed, so a client
 * that missed one never has to reconcile the next.
 */
export const MemberUpdatedEvent = Schema.TaggedStruct( "chat/evt/MemberUpdated", {
	member: ChatMember
} );

export const MessageEvent = Schema.TaggedStruct( "chat/evt/Message", { message: ChatMessage } );

export const SignalEvent = Schema.TaggedStruct( "chat/evt/Signal", {
	from: Schema.String,
	payload: SignalPayload
} );

/**
 * Why something the client asked for did not happen. Sent only to the
 * connection that asked.
 *
 * - call-full: The call already has `MAX_CALL_SIZE` people in it.
 * - not-a-player: Only seated players may join the call.
 * - joined-elsewhere: The same user joined the call from another tab, which
 * 		took this one out of it.
 * - too-fast: A message was sent over the pace limit and dropped.
 */
export type RefusalReason = typeof RefusalReason.Type;
export const RefusalReason = Schema.Literals( [
	"call-full",
	"not-a-player",
	"joined-elsewhere",
	"too-fast"
] );

export const RefusedEvent = Schema.TaggedStruct( "chat/evt/Refused", { reason: RefusalReason } );

/** Keeps the line warm and lets the client tell a dead socket from a quiet one. */
export const HeartbeatEvent = Schema.TaggedStruct( "chat/evt/Heartbeat", {} );

export type ServerEvent = typeof ServerEvent.Type;
export const ServerEvent = Schema.Union( [
	SnapshotEvent,
	MemberJoinedEvent,
	MemberLeftEvent,
	MemberUpdatedEvent,
	MessageEvent,
	SignalEvent,
	RefusedEvent,
	HeartbeatEvent
] );

export const ServerEventJson = Schema.fromJsonString( ServerEvent );
