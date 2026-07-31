import * as Cloudflare from "alchemy/Cloudflare";
import * as Layer from "effect/Layer";
import * as Effect from "effect/Effect";

import type { AuthInfo } from "@/auth/shared/schema.ts";
import { SessionStore } from "@/auth/server/session.ts";

export const SessionKV = Cloudflare.KV.Namespace( "SessionKV" );

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const SessionStoreLive = Layer.effect(
	SessionStore,
	Effect.gen( function* () {
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( SessionKV );
		return SessionStore.of( {
			get: key => Effect.orDie( kv.get<AuthInfo>( key, "json" ) ),
			set: ( key, value ) => Effect.orDie(
				kv.put( key, JSON.stringify( value ), { expirationTtl: TTL_SECONDS } )
			),
			delete: key => Effect.orDie( kv.delete( key ) )
		} );
	} )
);
