import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { GameArchive } from "@/shared/swish/services.ts";

export const ArchiveKV = Cloudflare.KV.Namespace( "ArchiveKV" );

export const GameArchiveLive = ( kv: Cloudflare.KV.ReadWriteNamespaceClient ) =>
	Layer.succeed( GameArchive, GameArchive.of( {
		save: ( key, encoded ) => Effect.orDie( kv.put( key, JSON.stringify( encoded ) ) ),

		load: key => Effect.orDie( kv.get<unknown>( key, "json" ) ).pipe(
			Effect.map( Option.fromNullishOr )
		),

		remove: key => Effect.orDie( kv.delete( key ) )
	} ) );
