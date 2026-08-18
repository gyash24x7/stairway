import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SessionStore } from "@/auth/server/session.ts";
import { withRuntime } from "@/platform/utils/runtime.ts";

import type { AuthInfo } from "@/auth/shared/schema.ts";

export const SessionKV = Cloudflare.KV.Namespace( "SessionKV" );

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const SessionStoreLive = Layer.effect(
	SessionStore,
	Effect.gen( function* () {
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( SessionKV );
		return SessionStore.of( {
			get: key => withRuntime( kv.get<AuthInfo>( key, "json" ).pipe( Effect.orDie ) ),
			set: ( key, value ) => withRuntime(
				kv.put( key, JSON.stringify( value ), { expirationTtl: TTL_SECONDS } )
					.pipe( Effect.orDie )
			),
			delete: key => withRuntime( kv.delete( key ).pipe( Effect.orDie ) )
		} );
	} )
);
