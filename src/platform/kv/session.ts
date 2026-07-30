import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const SessionKV = Cloudflare.KV.Namespace( "SessionKV" );

export class SessionStore extends Context.Service<SessionStore, {
	get: ( key: string ) => Promise<string | null>;
	set: ( key: string, value: string, expirationTtl?: number ) => Promise<void>;
	delete: ( key: string ) => Promise<void>;
}>()( "stairway/SessionStore" ) {}

export const SessionStoreLive = Layer.effect(
	SessionStore,
	Effect.gen( function* () {
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( SessionKV );
		return SessionStore.of( {
			get: key => Effect.runPromise(
				kv.get( key ).pipe(
					Effect.provide( Alchemy.RuntimeContext.phantom )
				)
			),
			set: ( key, value, expirationTtl = 1 ) => Effect.runPromise(
				kv.put( key, value, { expirationTtl: expirationTtl * 60 } ).pipe(
					Effect.provide( Alchemy.RuntimeContext.phantom )
				)
			),
			delete: key => Effect.runPromise(
				kv.delete( key ).pipe(
					Effect.provide( Alchemy.RuntimeContext.phantom )
				)
			)
		} );
	} )
).pipe( Layer.provide( Cloudflare.KV.ReadWriteNamespaceBinding ) );