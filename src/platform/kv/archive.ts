import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { withRuntime } from "@/platform/utils/runtime.ts";
import { SwishArchive } from "@/swish/server/services.ts";

import type { GameAddress } from "@/swish/server/services.ts";

export const ArchiveKV = Cloudflare.KV.Namespace( "ArchiveKV" );

export const SwishArchiveLive = ( kv: Cloudflare.KV.ReadWriteNamespaceClient ) =>
	Layer.succeed( SwishArchive, SwishArchive.of( {
		save: ( address, encoded ) => withRuntime(
			kv.put( `${ address.game }:${ address.id }`, JSON.stringify( encoded ) ).pipe(
				Effect.orDie
			)
		),

		load: <T>( address: GameAddress ) => withRuntime(
			kv.get<T>( `${ address.game }:${ address.id }`, "json" ).pipe(
				Effect.map( Option.fromNullishOr ),
				Effect.orDie
			)
		)
	} ) );
