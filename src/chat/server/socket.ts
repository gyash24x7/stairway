import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";

import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Socket from "effect/socket/Socket";

import { SESSION_COOKIE, SessionService } from "@/auth/server/sessions";
import { ClientEventJson, HeartbeatEvent, ServerEventJson, SnapshotEvent } from "@/chat/schema";
import { ChatAccess } from "@/chat/server/access";
import { ChatHistory } from "@/chat/server/history";
import { IceServers } from "@/chat/server/ice";
import { ChatRooms, roomKey } from "@/chat/server/rooms";
import { isGameName } from "@/shared/games";
import { CLIENT_SILENCE_LIMIT, HEARTBEAT_INTERVAL } from "@/world/server/socket";


const encode = Schema.encodeSync( ServerEventJson );
const decode = Schema.decodeUnknownOption( ClientEventJson );

/**
 * `GET /api/chat/socket?game=…&gameId=…`: one table's chat.
 *
 * A plain router route beside the `HttpApi`, for the reason the world's socket
 * is one: `HttpApi` has no way to describe a socket. It follows that socket's
 * shape throughout — the session checked once at the upgrade, frames that fail
 * to decode dropped, a heartbeat out and a silence watchdog in — and borrows
 * its timings, so both sockets look alike to any proxy in front of them.
 *
 * What it adds is the table. Before the upgrade the game is asked who the
 * caller is to it (`ChatAccess`). A stranger is refused with a 403, so nobody
 * can read a table's talk by guessing its id, and an unknown game is a 404.
 * Everybody else is let in as a player or a spectator.
 *
 * That answer is asked again on every `JoinCall`, because the call is the one
 * thing a spectator cannot do and a spectator can be seated while connected.
 * The rooms service holds the role; the socket is what refreshes it.
 *
 * The services are taken when the layer is built rather than inside the
 * handler, as on the world socket: a route handler's requirements are provided
 * per request by the router.
 */
export const ChatSocketRoute = Layer.effectDiscard( Effect.gen( function* () {
	const router = yield* HttpRouter.HttpRouter;
	const sessions = yield* SessionService;
	const access = yield* ChatAccess;
	const rooms = yield* ChatRooms;
	const history = yield* ChatHistory;
	const ice = yield* IceServers;

	yield* router.add( "GET", "/api/chat/socket", Effect.gen( function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const params = new URL( request.url, "http://localhost" ).searchParams;
		const game = params.get( "game" ) ?? "";
		const gameId = params.get( "gameId" ) ?? "";

		if ( !isGameName( game ) || gameId === "" ) {
			return HttpServerResponse.empty( { status: 404 } );
		}

		const user = yield* sessions.loadByToken( request.cookies[ SESSION_COOKIE ] ?? "" );
		if ( Option.isNone( user ) ) {
			return HttpServerResponse.empty( { status: 401 } );
		}

		const role = yield* access.resolve( game, gameId, user.value );
		if ( !role ) {
			return HttpServerResponse.empty( { status: 403 } );
		}

		const socket = yield* Effect.orDie( request.upgrade );
		const room = roomKey( game, gameId );

		yield* Effect.scoped( Effect.gen( function* () {
			const writer = yield* socket.writer;
			const send = ( event: Parameters<typeof encode>[ 0 ] ) => writer.write( encode( event ) );

			const { self, others, inbox } = yield* rooms.join( room, user.value, role );
			yield* Effect.addFinalizer( () => rooms.leave( self.connId ) );

			// Read after joining, so a message sent in between is in the backlog,
			// the inbox, or both — never neither. The client drops the repeat by id.
			const messages = yield* history.read( room );
			const iceServers = yield* ice.get;
			yield* send( SnapshotEvent.make( { self, members: others, messages, iceServers } ) );

			yield* Queue.take( inbox ).pipe(
				Effect.flatMap( send ),
				Effect.forever,
				Effect.forkScoped
			);
			yield* send( HeartbeatEvent.make( {} ) ).pipe(
				Effect.repeat( Schedule.spaced( HEARTBEAT_INTERVAL ) ),
				Effect.delay( HEARTBEAT_INTERVAL ),
				Effect.forkScoped
			);

			const pull = yield* Socket.readerString( socket );
			let lastHeardAt = yield* Clock.currentTimeMillis;

			const read = Effect.gen( function* () {
				while ( true ) {
					const frames = yield* pull;
					lastHeardAt = yield* Clock.currentTimeMillis;
					for ( const frame of frames ) {
						const message = decode( frame );
						if ( Option.isNone( message ) ) {
							continue;
						}

						if ( message.value._tag === "chat/evt/JoinCall" ) {
							const fresh = yield* access.resolve( game, gameId, user.value );
							yield* rooms.setRole( self.connId, fresh ?? "spectator" );
						}

						yield* rooms.handle( self.connId, message.value );
					}
				}
			} );

			const watch = Effect.gen( function* () {
				while ( true ) {
					yield* Effect.sleep( HEARTBEAT_INTERVAL );
					const now = yield* Clock.currentTimeMillis;
					if ( now - lastHeardAt > Duration.toMillis( CLIENT_SILENCE_LIMIT ) ) {
						yield* Effect.logDebug( "chat socket silent, dropping", self.connId );
						return;
					}
				}
			} );

			yield* Effect.raceFirst( read, watch );
		} ) ).pipe(
			Effect.catchReason( "SocketError", "SocketCloseError", () => Effect.void ),
			Effect.catch( error => Effect.logDebug( "chat socket ended", error ) )
		);

		return HttpServerResponse.empty();
	} ) );
} ) );
