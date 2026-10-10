import * as Schema from "effect/Schema";


/**
 * The world's wire protocol. Both directions travel as JSON text frames over
 * the single socket at `/api/world/socket`.
 *
 * Presence is not game state, so it is deliberately not event-sourced: nothing
 * here is stored, replayed or archived. A reconnecting client is sent a fresh
 * `Snapshot` and carries on from there, which is the same blunt resync
 * `withReconnect` relies on for game views.
 */

export type Pos = typeof Pos.Type;
export const Pos = Schema.Struct( { x: Schema.Int, y: Schema.Int } );

export type Facing = typeof Facing.Type;
export const Facing = Schema.Literals( [ "up", "down", "left", "right" ] );

export type MeepleStatus = typeof MeepleStatus.Type;
export const MeepleStatus = Schema.Literals( [ "idle", "playing" ] );

/** Short enough for a speech bubble over an avatar's head. */
export const MAX_SAY_LENGTH = 140;

/**
 * One person in the world.
 *
 * - connId: The connection, not the user. Two tabs are two avatars, so closing
 * 		one tab removes only its own avatar.
 * - room: The game whose room the avatar is in. The server derives it from
 * 		`pos`, so a client cannot claim to be in a room it is not in.
 * - status: Whether the avatar has a game open. Shown as a badge so others can
 * 		see who is busy.
 */
export type Meeple = typeof Meeple.Type;
export const Meeple = Schema.Struct( {
	connId: Schema.String,
	userId: Schema.String,
	name: Schema.String,
	avatar: Schema.String,
	pos: Pos,
	facing: Facing,
	room: Schema.NullOr( Schema.String ),
	status: MeepleStatus
} );


// --- Client → server ------------------------------------------------------

export const MoveEvent = Schema.TaggedStruct( "world/evt/Move", { pos: Pos, facing: Facing } );
export const SetStatusEvent = Schema.TaggedStruct(
	"world/evt/SetStatus",
	{ status: MeepleStatus }
);

export const SayEvent = Schema.TaggedStruct( "world/evt/Say", {
	text: Schema.String.check( Schema.isMaxLength( MAX_SAY_LENGTH ) )
} );

/**
 * The client's answer to every `HeartbeatEvent`.
 *
 * It proves the page is still running, not just that its socket is still
 * open. A page frozen in the back/forward cache keeps its socket open, so the
 * server's own writes go on succeeding, but it runs no script and so never
 * answers. The server drops a connection that has not answered in a while
 * (`CLIENT_SILENCE_LIMIT`), which removes avatars that would otherwise stand
 * in the world after their person left.
 */
export const PongEvent = Schema.TaggedStruct( "world/evt/Pong", {} );

export type ClientEvent = typeof ClientEvent.Type;
export const ClientEvent = Schema.Union( [ MoveEvent, SetStatusEvent, SayEvent, PongEvent ] );
export const ClientEventJson = Schema.fromJsonString( ClientEvent );


// --- Server → client ------------------------------------------------------

/** The first frame on every connection: who you are, and everyone else already here. */
export const SnapshotEvent = Schema.TaggedStruct( "world/evt/Snapshot", {
	self: Meeple,
	others: Schema.Array( Meeple )
} );

export const JoinedEvent = Schema.TaggedStruct( "world/evt/Joined", { avatar: Meeple } );
export const LeftEvent = Schema.TaggedStruct( "world/evt/Left", { connId: Schema.String } );

/**
 * An avatar now stands at `pos`.
 *
 * The mover receives this too. A step that was accepted echoes the position
 * the client already predicted. A step that was refused carries the position
 * the server kept, which moves the client's avatar back where it belongs.
 */
export const MovedEvent = Schema.TaggedStruct( "world/evt/Moved", {
	connId: Schema.String,
	pos: Pos,
	facing: Facing,
	room: Schema.NullOr( Schema.String )
} );

export const StatusChangedEvent = Schema.TaggedStruct( "world/evt/StatusChanged", {
	connId: Schema.String,
	status: MeepleStatus
} );

export const SaidEvent = Schema.TaggedStruct(
	"world/evt/Said",
	{ connId: Schema.String, text: Schema.String }
);

/**
 * Sent on every socket at a fixed interval, carrying nothing.
 *
 * It does two jobs. Proxies in front of the server (Railway's edge, for one)
 * close a WebSocket that has gone quiet, and someone standing still in the
 * world produces no traffic, so this keeps the line warm. And a client that
 * hears nothing at all, not even this, knows the connection is dead even
 * though the browser has not noticed. That is the same role the 10s heartbeat
 * plays on a game's SSE stream (see `withLiveness`).
 */
export const HeartbeatEvent = Schema.TaggedStruct( "world/evt/Heartbeat", {} );

export type ServerEvent = typeof ServerEvent.Type;
export const ServerEvent = Schema.Union( [
	SnapshotEvent,
	JoinedEvent,
	LeftEvent,
	MovedEvent,
	StatusChangedEvent,
	SaidEvent,
	HeartbeatEvent
] );

export const ServerEventJson = Schema.fromJsonString( ServerEvent );
