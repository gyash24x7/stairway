import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Semaphore from "effect/Semaphore";
import { HttpServerResponse } from "effect/unstable/http";

import { SessionService } from "@/auth/server/session.ts";
import { DurableScheduleLive } from "@/platform/do/schedule.ts";
import { DurableStorageLive } from "@/platform/do/storage.ts";

import type { UserId } from "@/auth/shared/schema.ts";
import type { DurableSchedule } from "@/platform/do/schedule.ts";
import type { DurableStorage } from "@/platform/do/storage.ts";

// --- Websocket Channel ---------------------------------------------------------

/**
 * WebsocketChannel exposes an API to interact with the connected sockets.
 * - broadcast: Publish the message to all connected sockets.
 * - publishMessages: Publish specific messages to the specified users.
 * - audience: Returns the userIds of the connected sockets.
 */
export class WebSocketChannel extends Context.Service<WebSocketChannel, {
	readonly broadcast: ( message: string ) => Effect.Effect<void>;
	readonly publishMessages: ( messages: ReadonlyMap<UserId, string> ) => Effect.Effect<void>;
	readonly audience: () => Effect.Effect<ReadonlyArray<UserId>>;

}>()( "cf/WebSocketChannel" ) {}


// --- Base Websocket Durable Object ------------------------------------------------

/**
 * Runs the domain's methods one at a time.
 *
 * A Durable Object is single-threaded but not single-fibered: two RPCs already
 * admitted can interleave at any await, and a domain method that reads state,
 * awaits, then writes it back has a lost-update window between the two. The
 * engine's `submitMove` is exactly that shape — it loads the record, decodes the
 * caller's input, then commits work built from the snapshot it loaded — so two
 * players moving at once can have the second overwrite the first while the
 * commit log keeps both, and the version stays consistent enough that nothing
 * downstream notices.
 *
 * Serializing here is the blunt fix, and it belongs to the host: it costs
 * nothing on a table where one player moves at a time, and it holds for every
 * domain rather than for whichever one remembered. The sharper fix is for
 * `SwishStorage.writeCommit` to reject a write whose cursor has moved.
 *
 * @param shape - The domain methods, each returning an Effect.
 * @param gate - The semaphore admitting one of them at a time.
 * @returns The same methods, each queued behind the gate.
 */
const serialize = <Shape extends object>( shape: Shape, gate: Semaphore.Semaphore ) =>
	Object.fromEntries(
		Object.entries( shape ).map( ( [ name, method ] ) => [
			name,
			typeof method === "function"
				? ( ...args: ReadonlyArray<unknown> ) =>
					gate.withPermits( 1 )( method( ...args ) as Effect.Effect<unknown, unknown> )
				: method
		] )
	) as Shape;

export type WebSocketDurableObjectServices =
	| WebSocketChannel
	| DurableStorage
	| DurableSchedule
	| Cloudflare.DurableObjectState;

/**
 * The two-phase implementation of an auth-gated, hibernating WebSocket Durable
 * Object, parameterised by the domain methods it exposes over RPC.
 *
 * The base owns the socket lifecycle — the upgrade handshake, the per-user
 * socket map, its rehydration from serialized attachments after hibernation, and
 * close. The domain owns everything else.
 *
 * The domain can request for DurableStorage and WebsocketChannel which are
 * provided at appropriate stages by the inner effect.
 *
 * @param domain - The domain methods, built against the object's local services.
 * @returns The Durable Object implementation, for `Cloudflare.DurableObject`.
 */
export const WebSocketDurableObject = <Shape extends object>(
	domain: Effect.Effect<Shape, never, WebSocketDurableObjectServices>
) => Effect.gen( function* () {
	const ctx = yield* Cloudflare.DurableObjectState;
	const sessions = yield* SessionService;

	return Effect.gen( function* () {
		const sockets = new Map<Cloudflare.WebSocket, UserId>();

		for ( const socket of yield* ctx.getWebSockets() ) {
			const userId = socket.deserializeAttachment<UserId>();
			if ( userId ) {
				sockets.set( socket, userId );
			}
		}

		const channel = WebSocketChannel.of( {
			broadcast: Effect.fn( function* ( message: string ) {
				for ( const socket of sockets.keys() ) {
					yield* socket.send( message ).pipe(
						Effect.catchCause( () => Effect.sync( () => {
							sockets.delete( socket );
						} ) )
					);
				}
			} ),

			publishMessages: Effect.fn( function* ( messages: ReadonlyMap<UserId, string> ) {
				for ( const [ socket, userId ] of sockets.entries() ) {
					const message = messages.get( userId );
					if ( message ) {
						yield* socket.send( message ).pipe(
							Effect.catchCause( () => Effect.sync( () => {
								sockets.delete( socket );
							} ) )
						);
					}
				}
			} ),

			audience: () => Effect.succeed( [ ...new Set( sockets.values() ) ] )
		} );

		const shape = yield* domain.pipe( Effect.provideService( WebSocketChannel, channel ) );

		return {
			...serialize( shape, yield* Semaphore.make( 1 ) ),

			fetch: Effect.gen( function* () {
				const authInfo = yield* sessions.load();
				if ( !authInfo ) {
					return HttpServerResponse.text( "Unauthorized", { status: 401 } );
				}

				const [ response, socket ] = yield* Cloudflare.upgrade();
				socket.serializeAttachment( authInfo.id );
				sockets.set( socket, authInfo.id );
				return response;
			} ),

			webSocketClose: Effect.fn( function* (
				socket: Cloudflare.WebSocket,
				code: number,
				reason: string
			) {
				sockets.delete( socket );
				yield* socket.close( code, reason ).pipe( Effect.catchCause( () => Effect.void ) );
			} )
		};

	} ).pipe(
		Effect.provide( DurableStorageLive( ctx ) ),
		Effect.provide( DurableScheduleLive( ctx ) )
	);
} );
