import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { withRuntime } from "@/platform/utils/runtime.ts";
import { PushStore } from "@/push/server/store.ts";
import { removeEndpoints, upsertDevice } from "@/push/shared/devices.ts";

import type { UserId } from "@/auth/shared/schema.ts";
import type { PushDevice } from "@/push/shared/schema.ts";

export const PushKV = Cloudflare.KV.Namespace( "PushKV" );

/**
 * Abandoned devices age out on their own rather than needing a sweeper. Every
 * upsert refreshes the whole record, so an actively used device never expires.
 */
const TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days

const keyFor = ( userId: UserId ) => `push:${ userId }`;

type StoredDevices = { readonly devices: ReadonlyArray<PushDevice> };

/**
 * Builds a `PushStore` over an already-resolved KV client.
 *
 * Mirrors `SwishArchiveLive`: the Durable Object resolves its namespace once at
 * the top of its body and passes the client down, so re-resolving the binding
 * per layer would be wasted work.
 */
export const PushStoreFrom = ( kv: Cloudflare.KV.ReadWriteNamespaceClient ) => {
	const read = ( userId: UserId ) => withRuntime(
		kv.get<StoredDevices>( keyFor( userId ), "json" ).pipe(
			Effect.map( stored => stored?.devices ?? [] ),
			Effect.orDie
		)
	);

	const write = ( userId: UserId, devices: ReadonlyArray<PushDevice> ) => withRuntime(
		( devices.length === 0
			? kv.delete( keyFor( userId ) )
			: kv.put(
				keyFor( userId ),
				JSON.stringify( { devices } satisfies StoredDevices ),
				{ expirationTtl: TTL_SECONDS }
			) ).pipe( Effect.orDie )
	);

	return Layer.succeed( PushStore, PushStore.of( {
		load: read,

		upsert: ( userId, device ) => Effect.gen( function* () {
			const devices = yield* read( userId );
			yield* write( userId, upsertDevice( devices, device, device.lastSeenAt ) );
		} ),

		remove: ( userId, endpoints ) => Effect.gen( function* () {
			if ( endpoints.length === 0 ) {
				return;
			}

			const devices = yield* read( userId );
			const next = removeEndpoints( devices, endpoints );
			if ( next.length !== devices.length ) {
				yield* write( userId, next );
			}
		} )
	} ) );
};

/** Resolves the binding itself, for the HTTP API worker. */
export const PushStoreLive = Layer.unwrap(
	Effect.gen( function* () {
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( PushKV );
		return PushStoreFrom( kv );
	} )
);
