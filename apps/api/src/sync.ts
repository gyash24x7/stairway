// The realtime connection-manager Durable Object.
//
// One instance per game, addressed by name `${gameName}:${gameId}` (e.g.
// `fish:12233434`). It is a *plain* `Cloudflare.DurableObject` (not the
// `RpcDurableObject` the game engines use) because only the plain variant
// exposes the WebSocket Hibernation hooks. It does two things:
//
//   1. `fetch` — accepts a client's WebSocket upgrade (the API Worker forwards
//      `GET /sync/:gameName/:gameId` here) and tags the socket with the caller's
//      audience (a `?playerId=` query ⇒ that player; absent ⇒ the table view).
//   2. `broadcast` — an RPC method the engine calls (via the `Sync` service in
//      `DurableSwishLive`) after every commit: it fans the fresh per-audience
//      snapshots out to every connected socket, each getting the snapshot for
//      its own tagged audience.
//
// Declared inline (class + impl) like the engine `RpcDurableObject`s in
// `cloudflare.ts`; the namespace then resolves ambiently from the hosting Worker
// (`yield* GameChannel`), so both the Worker's WS route and the engine DOs can
// reach it without a separate Live layer.

import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";

/** What we stash on each socket so `broadcast` can route the right view to it. */
type SocketAudience =
	| { readonly _tag: "swish/Player"; readonly id: string }
	| { readonly _tag: "swish/Table" };

interface Attachment {
	readonly audience: SocketAudience;
}

/** The per-audience payload the engine hands `broadcast` (already JSON-plain). */
interface BroadcastSnapshot {
	readonly table: unknown;
	readonly playerViews: Record<string, unknown>;
}

export class GameChannel extends Cloudflare.DurableObject<GameChannel>()(
	"GameChannel",
	Effect.gen( function* () {
		const state = yield* Cloudflare.DurableObjectState;

		return Effect.gen( function* () {
			return {
				// Client → DO WebSocket upgrade, forwarded here by the API Worker.
				fetch: Effect.gen( function* () {
					const request = yield* HttpServerRequest.HttpServerRequest;
					// `request.url` may be path-relative; a dummy base makes it parseable.
					const playerId = new URL( request.url, "http://sync" ).searchParams.get( "playerId" );
					const audience: SocketAudience = playerId
						? { _tag: "swish/Player", id: playerId }
						: { _tag: "swish/Table" };

					const [ response, socket ] = yield* Cloudflare.upgrade();
					// Persist the audience so a hibernated socket recovered via
					// `getWebSockets()` still knows which view it should receive.
					socket.serializeAttachment<Attachment>( { audience } );
					return response;
				} ),

				webSocketClose: ( socket: Cloudflare.WebSocket, code: number, reason: string ) =>
					socket.close( code, reason ),

				// Engine → DO push. Send each socket the snapshot for its own audience.
				broadcast: ( snapshot: BroadcastSnapshot ) => Effect.gen( function* () {
					for ( const socket of yield* state.getWebSockets() ) {
						const attachment = socket.deserializeAttachment<Attachment>();
						const audience = attachment?.audience;
						const payload = audience?._tag === "swish/Player"
							? snapshot.playerViews[ audience.id ] ?? snapshot.table
							: snapshot.table;
						yield* socket.send( JSON.stringify( payload ) ).pipe( Effect.ignore );
					}
				} )
			};
		} );
	} )
) {}
