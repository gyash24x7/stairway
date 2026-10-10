import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";

import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Socket from "effect/socket/Socket";

import { SESSION_COOKIE, SessionService } from "@/auth/server/sessions";
import { ClientEventJson, HeartbeatEvent, ServerEventJson, SnapshotEvent } from "@/world/schema";
import { WorldPresence } from "@/world/server/presence";


const encode = Schema.encodeSync( ServerEventJson );
const decode = Schema.decodeUnknownOption( ClientEventJson );

/**
 * How often each socket is sent a `HeartbeatEvent`. This must stay well under
 * both the idle timeout of any proxy in front of the server and the client's
 * `SILENCE_LIMIT`, which treats a third of a minute without a frame as a dead
 * connection.
 */
export const HEARTBEAT_INTERVAL = Duration.seconds( 10 );

/**
 * How long a connection may go without sending anything, its `PongEvent`
 * replies included, before the server drops it. That is three missed
 * heartbeats.
 */
export const CLIENT_SILENCE_LIMIT = Duration.seconds( 30 );

/**
 * `GET /api/world/socket`: the world's one WebSocket.
 *
 * This is a plain router route, not an `HttpApi` endpoint. `HttpApi` has no way
 * to describe a socket, and the world needs a socket because the rest of the
 * app's pattern (moves sent by POST, views pushed over SSE) would mean an
 * authenticated POST for every step at walking pace.
 *
 * The session is checked once, at the upgrade, by the same cookie
 * `AuthMiddleware` reads. An unauthenticated request gets a 401 before the
 * upgrade. A socket that was let in stays in until it closes, even if the
 * session ends meanwhile, which is acceptable for something that only shows
 * where people are standing.
 *
 * Messages that fail to decode are dropped. Nothing a client sends can break
 * the connection or anyone else's.
 *
 * The services are taken when the layer is built rather than inside the
 * handler. A route handler's requirements are provided per request by the
 * router, so a handler that asked for them would need them provided to the
 * whole server.
 */
export const WorldSocketRoute = Layer.effectDiscard( Effect.gen( function* () {
	const router = yield* HttpRouter.HttpRouter;
	const sessions = yield* SessionService;
	const presence = yield* WorldPresence;

	yield* router.add( "GET", "/api/world/socket", Effect.gen( function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;

		const user = yield* sessions.loadByToken( request.cookies[ SESSION_COOKIE ] ?? "" );
		if ( Option.isNone( user ) ) {
			return HttpServerResponse.empty( { status: 401 } );
		}

		const socket = yield* Effect.orDie( request.upgrade );

		yield* Effect.scoped( Effect.gen( function* () {
			const writer = yield* socket.writer;
			const send = ( event: Parameters<typeof encode>[ 0 ] ) => writer.write( encode( event ) );

			const { self, others, events } = yield* presence.join( user.value );
			yield* Effect.addFinalizer( () => presence.leave( self.connId ) );

			yield* send( SnapshotEvent.make( { self, others } ) );
			yield* PubSub.take( events ).pipe(
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
						if ( Option.isSome( message ) ) {
							yield* presence.handle( self.connId, message.value );
						}
					}
				}
			} );

			// Ends the connection once the client has been silent too long.
			// Whichever of the two finishes first ends the scope, which runs
			// `leave`.
			const watch = Effect.gen( function* () {
				while ( true ) {
					yield* Effect.sleep( HEARTBEAT_INTERVAL );
					const now = yield* Clock.currentTimeMillis;
					if ( now - lastHeardAt > Duration.toMillis( CLIENT_SILENCE_LIMIT ) ) {
						yield* Effect.logDebug( "world socket silent, dropping", self.connId );
						return;
					}
				}
			} );

			yield* Effect.raceFirst( read, watch );
		} ) ).pipe(
			// A closed socket is how every connection ends, so it is not an error.
			Effect.catchReason( "SocketError", "SocketCloseError", () => Effect.void ),
			Effect.catch( error => Effect.logDebug( "world socket ended", error ) )
		);

		return HttpServerResponse.empty();
	} ) );
} ) );
