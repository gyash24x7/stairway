import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { GameArchive } from "@/shared/swish/services.ts";

export const ArchiveKV = Cloudflare.KV.Namespace( "ArchiveKV" );

/**
 * Resolves the archive KV client. Yield this in a Durable Object's *outer*
 * (build-time) scope, alongside `DurableObjectState`: binding a namespace needs
 * alchemy's provider context, which a DO's inner (per-request) effect is not
 * allowed to carry — exactly why `DurableSyncLive` takes its namespace as an
 * argument rather than resolving one itself.
 */
export const archiveNamespace = Cloudflare.KV.ReadWriteNamespace( ArchiveKV ).pipe(
	Effect.provide( Cloudflare.KV.ReadWriteNamespaceBinding )
);

/**
 * Backs {@link GameArchive} with a KV namespace, keyed `${gameName}:${gameId}`.
 * Unlike the session/challenge stores nothing here carries an `expirationTtl` —
 * an archived game is the permanent record of a finished match.
 *
 * @param kv - The archive KV client, from {@link archiveNamespace}.
 * @returns The `GameArchive` layer for one Durable Object.
 */
export const GameArchiveLive = ( kv: Cloudflare.KV.ReadWriteNamespaceClient ) =>
	Layer.succeed( GameArchive, GameArchive.of( {
		save: ( key, encoded ) => Effect.orDie( kv.put( key, JSON.stringify( encoded ) ) ),

		load: key => Effect.orDie( kv.get<unknown>( key, "json" ) ).pipe(
			Effect.map( Option.fromNullishOr )
		),

		remove: key => Effect.orDie( kv.delete( key ) )
	} ) );
