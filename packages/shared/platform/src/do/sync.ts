import { type Audience, PlayerAudience, PlayerId, TableAudience } from "@s2h/swish/schema";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";

/** The per-audience payload the engine hands `broadcast` (already JSON-plain). */
interface BroadcastSnapshot {
	readonly table: unknown;
	readonly playerViews: Record<string, unknown>;
}

/**
 * Realtime fan-out. After every state-changing command the engine hands the host
 * the fresh per-audience snapshots (`table` + one per player) for a `channel`
 * (the game's `${name}:${id}`); the host pushes each connected client the
 * snapshot for its own audience. Game-agnostic: the payloads are already-plain
 * (JSON-serializable) `GameSnapshot`s the engine computed, so the host never
 * touches game schemas. A no-op layer backs tests / pushless deployments.
 */
export class Sync extends Context.Service<Sync, {
	readonly broadcast: ( channel: string, snapshot: BroadcastSnapshot ) =>
		Effect.Effect<void, never, Alchemy.RuntimeContext>;
}>()( "stairway/Sync" ) {}

interface Attachment {
	readonly audience: Audience;
}

export class GameChannel extends Cloudflare.DurableObject<GameChannel>()(
	"GameChannel",
	Effect.gen( function* () {
		const state = yield* Cloudflare.DurableObjectState;

		return Effect.gen( function* () {
			const sessions = new Map<Attachment, Cloudflare.WebSocket>();

			for ( const socket of yield* state.getWebSockets() ) {
				const attachment = socket.deserializeAttachment<Attachment>();
				if ( attachment ) {
					sessions.set( attachment, socket );
				}
			}

			return {
				fetch: Effect.gen( function* () {
					const request = yield* HttpServerRequest.HttpServerRequest;
					const playerId = new URL( request.url, "http://sync" ).searchParams.get( "playerId" );
					const audience = playerId
						? PlayerAudience.make( { id: PlayerId.make( playerId ) } )
						: TableAudience.make( {} );

					const [ response, socket ] = yield* Cloudflare.upgrade();
					socket.serializeAttachment<Attachment>( { audience } );
					sessions.set( { audience }, socket );
					return response;
				} ),

				webSocketClose: Effect.fn( function* (
					ws: Cloudflare.WebSocket,
					code: number,
					reason: string
				) {
					const attachment = ws.deserializeAttachment<Attachment>();
					if ( attachment ) {
						sessions.delete( attachment );
					}

					yield* ws.close( code, reason );
				} ),

				// Engine → DO push. Send each socket the snapshot for its own audience.
				broadcast: Effect.fn( function* ( snapshot: BroadcastSnapshot ) {
					for ( const [ attachment, socket ] of sessions.entries() ) {
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

export type GameChannelNamespace = Cloudflare.DurableObject<GameChannel>;

export const DurableSyncLive = ( channels: GameChannelNamespace ) =>
	Layer.succeed( Sync, Sync.of( {
		broadcast: ( channel, snapshot ) => channels.getByName( channel ).broadcast( snapshot )
	} ) );
