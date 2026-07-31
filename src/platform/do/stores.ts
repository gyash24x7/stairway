import type * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { EventStore, GameStore } from "@/shared/swish/services.ts";

const KEY_GAME = "gameData";
const KEY_LOG_BASE = "log:base";
const KEY_LOG_COMMITS = "log:commits";
const KEY_LOG_CURSOR = "log:cursor";

export const DurableGameStoreLive = ( ctx: Cloudflare.DurableObjectState[ "Service" ] ) =>
	Layer.succeed(
		GameStore,
		GameStore.of( {
			load: <T>() => ctx.storage.get<T>( KEY_GAME ).pipe(
				Effect.map( ( value ) => Option.fromNullishOr( value ) )
			),
			save: ( encoded ) => ctx.storage.put( KEY_GAME, encoded ),
			clear: () => ctx.storage.deleteAll()
		} )
	);

export const DurableEventStoreLive = ( ctx: Cloudflare.DurableObjectState[ "Service" ] ) => {
	const readCommits = ctx.storage.get<ReadonlyArray<unknown>>( KEY_LOG_COMMITS )
		.pipe( Effect.map( ( c ) => c ?? [] ) );

	const readCursor = ctx.storage.get<number>( KEY_LOG_CURSOR )
		.pipe( Effect.map( ( c ) => c ?? -1 ) );

	return Layer.succeed( EventStore, EventStore.of( {
		setBase: ( encoded ) => Effect.gen( function* () {
			yield* ctx.storage.put( KEY_LOG_BASE, encoded );
			yield* ctx.storage.put( KEY_LOG_COMMITS, [] );
			yield* ctx.storage.put( KEY_LOG_CURSOR, -1 );
		} ),

		append: ( commit ) => Effect.gen( function* () {
			const commits = yield* readCommits;
			const cursor = yield* readCursor;
			const kept = [ ...commits.slice( 0, cursor + 1 ), commit ];

			yield* ctx.storage.put( KEY_LOG_COMMITS, kept );
			yield* ctx.storage.put( KEY_LOG_CURSOR, kept.length - 1 );
		} ),

		moveCursor: ( delta ) => Effect.gen( function* () {
			const commits = yield* readCommits;
			const cursor = yield* readCursor;

			const next = cursor + delta;
			if ( next < -1 || next > commits.length - 1 ) {
				return Option.none();
			}

			yield* ctx.storage.put( KEY_LOG_CURSOR, next );
			const movedOver = delta === -1 ? commits[ cursor ] : commits[ next ];
			return Option.fromNullishOr( movedOver );

		} ),

		read: () => Effect.gen( function* () {
			const base = yield* ctx.storage.get<unknown>( KEY_LOG_BASE );
			const commits = yield* readCommits;
			const cursor = yield* readCursor;
			return { base, commits, cursor };

		} )
	} ) );
};