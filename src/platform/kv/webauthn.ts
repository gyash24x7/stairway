import * as Cloudflare from "alchemy/Cloudflare";
import * as Layer from "effect/Layer";
import * as Effect from "effect/Effect";

import type { AuthFlow } from "@/auth/shared/schema.ts";
import { WebAuthnStore } from "@/auth/server/webauthn.ts";

export const WebAuthnKV = Cloudflare.KV.Namespace( "WebAuthnKV" );

const CHALLENGE_TTL = 300; // 5 minutes

export const WebAuthnStoreLive = Layer.effect(
	WebAuthnStore,
	Effect.gen( function* () {
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( WebAuthnKV );
		return WebAuthnStore.of( {
			get: key => Effect.orDie( kv.get<AuthFlow>( key, "json" ) ),
			set: ( key, value ) => Effect.orDie(
				kv.put( key, JSON.stringify( value ), { expirationTtl: CHALLENGE_TTL } )
			),
			delete: key => Effect.orDie( kv.delete( key ) )
		} );
	} )
);
