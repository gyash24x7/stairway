import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { admitSocket, type BroadcastSnapshot, frameFor } from "@/platform/do/rules.ts";
import { Sync } from "@/shared/swish/services.ts";
import { type Audience, GameFrame } from "@/shared/swish/schema.ts";
import { SessionService } from "@/auth/server/session.ts";
import { SessionServiceLive } from "@/auth/server/session.ts";
import { SessionStoreLive } from "@/platform/kv/session.ts";

interface Attachment {
	readonly audience: Audience;
}

export class GameChannel extends Cloudflare.DurableObject<GameChannel>()(
	"GameChannel",
	Effect.gen( function* () {
		const state = yield* Cloudflare.DurableObjectState;
		const sessionService = yield* SessionService;

		return Effect.gen( function* () {
			const sessions = new Map<Cloudflare.WebSocket, Attachment>();

			for ( const socket of yield* state.getWebSockets() ) {
				const attachment = socket.deserializeAttachment<Attachment>();
				if ( attachment ) {
					sessions.set( socket, attachment );
				}
			}

			return {
				fetch: Effect.gen( function* () {
					const request = yield* HttpServerRequest.HttpServerRequest;
					const playerId = new URL( request.url, "http://sync" ).searchParams.get( "playerId" );
					const authInfo = yield* sessionService.load();

					const admission = admitSocket( playerId, authInfo?.id ?? null );
					if ( admission._tag === "reject" ) {
						return HttpServerResponse.text(
							admission.status === 401 ? "Unauthorized" : "Forbidden",
							{ status: admission.status }
						);
					}

					const [ response, socket ] = yield* Cloudflare.upgrade();
					const attachment: Attachment = { audience: admission.audience };
					socket.serializeAttachment<Attachment>( attachment );
					sessions.set( socket, attachment );
					return response;
				} ),

				webSocketClose: Effect.fn( function* (
					ws: Cloudflare.WebSocket,
					code: number,
					reason: string
				) {
					sessions.delete( ws );
					yield* ws.close( code, reason );
				} ),

				// Engine → DO push. Send each socket the snapshot for its own audience.
				broadcast: Effect.fn( function* ( snapshot: BroadcastSnapshot ) {
					for ( const [ socket, attachment ] of sessions.entries() ) {
						const frame = JSON.stringify( GameFrame.make( {
							snapshot: frameFor( attachment.audience, snapshot )
						} ) );

						yield* socket.send( frame ).pipe( Effect.ignore );
					}
				} )
			};
		} );
	} ).pipe(
		Effect.provide( SessionServiceLive ),
		Effect.provide( SessionStoreLive ),
		Effect.provide( Cloudflare.KV.ReadWriteNamespaceBinding )
	)
) {}

export type GameChannelNamespace = Cloudflare.DurableObject<GameChannel>;

export const DurableSyncLive = ( channels: GameChannelNamespace ) =>
	Layer.succeed( Sync, Sync.of( {
		broadcast: ( channel, snapshot ) => channels.getByName( channel ).broadcast( snapshot )
	} ) );
