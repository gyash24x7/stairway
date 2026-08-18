import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { WebAuthnStore } from "@/auth/server/webauthn.ts";
import { withRuntime } from "@/platform/utils/runtime.ts";

import type { AuthFlow } from "@/auth/shared/schema.ts";

export const WebAuthnKV = Cloudflare.KV.Namespace( "WebAuthnKV" );

const CHALLENGE_TTL = 300; // 5 minutes

export const WebAuthnStoreLive = Layer.effect(
	WebAuthnStore,
	Effect.gen( function* () {
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( WebAuthnKV );
		return WebAuthnStore.of( {
			get: key => withRuntime( kv.get<AuthFlow>( key, "json" ).pipe( Effect.orDie ) ),
			put: ( value ) => withRuntime(
				kv.put( value.id, JSON.stringify( value ), { expirationTtl: CHALLENGE_TTL } )
					.pipe( Effect.orDie )
			),
			delete: key => withRuntime( kv.delete( key ).pipe( Effect.orDie ) )
		} );
	} )
);
