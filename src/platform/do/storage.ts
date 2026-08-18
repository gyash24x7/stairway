import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type * as Cloudflare from "alchemy/Cloudflare";

import { withRuntime } from "@/platform/utils/runtime.ts";


export type DurableTransaction = {
	get: <T>( key: string ) => Effect.Effect<T | undefined>;
	put: <T>( key: string, value: T ) => Effect.Effect<void>;
};

export class DurableStorage extends Context.Service<DurableStorage, DurableTransaction & {
	list: <T>( prefix: string ) => Effect.Effect<T[]>;
	clear: () => Effect.Effect<void>;
	transaction: <A>( fn: ( txn: DurableTransaction ) => Effect.Effect<A> ) => Effect.Effect<A>;
}>()( "cf/DurableStorage" ) {}


export const DurableStorageLive = ( ctx: Cloudflare.DurableObjectState["Service"] ) =>
	Layer.succeed( DurableStorage, DurableStorage.of( {
		get: <T>( key: string ) => withRuntime( ctx.storage.get<T>( key ) ),
		list: <T>( prefix: string ) => withRuntime(
			ctx.storage.list<T>( { prefix } ).pipe(
				Effect.map( map => [ ...map.values() ] )
			)
		),
		put: <T>( key: string, value: T ) => withRuntime( ctx.storage.put( key, value ) ),
		transaction: fn => withRuntime(
			ctx.storage.transaction( txn => fn( {
				get: <T>( key: string ) => withRuntime( txn.get<T>( key ) ),
				put: <T>( key: string, value: T ) => withRuntime( txn.put( key, value ) )
			} ) )
		),
		clear: () => withRuntime( ctx.storage.deleteAll() )
	} ) );
