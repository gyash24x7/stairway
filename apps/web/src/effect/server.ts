// apps/web/src/effect/server.ts — the Effect/HttpApi API served with alchemy v2.
//
// A self-contained demonstration, NOT wired into the running app (the production
// Worker is still `apps/web/src/worker.ts` + `wrangler.jsonc`). It shows the whole
// Stage-3 wiring end to end:
//
//   • `CounterEngineDO` — an alchemy v2 `RpcDurableObject` whose RPC contract IS
//     the swish `CounterRpcs` group. Inside the DO we run `RpcServer.toHttpEffect`
//     over that group, providing the engine's move handlers (`CounterRpcs.layer`)
//     and the six swish services backed by the DO's own storage / D1 / KV
//     (`makeSwishLayers`).
//
//   • `EffectServer` — an alchemy v2 `Cloudflare.Worker` that serves the Effect
//     `HttpApi` surfaces (`AuthApi` + `CounterApi`). Auth handlers get an
//     `HttpAppContext` (session loaded from the cookie); counter handlers get a
//     `CounterEngine` implemented by forwarding to the typed RPC client the DO
//     hands back via `getByName(gameId)` — the `:gameId` path param picks the
//     instance.
//
// Deploying this would be an `alchemy.run.ts` that binds `EffectServer`; that (and
// migrating the app off wrangler) is intentionally out of scope here.

import * as Cloudflare from "alchemy/Cloudflare";
import { Context, Effect, Layer } from "effect";
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { HttpAppContext } from "@s2h/api/context";
import { AuthApi, AuthApiLive } from "@s2h/auth/http";
import { loadSession } from "@s2h/auth/sessions";
import { CounterRpcs } from "@s2h/swish/examples/counter";
import { CounterApi, CounterApiLive, CounterEngine } from "@s2h/swish/examples/counter-api";
import { env } from "cloudflare:workers";
import { makeSwishLayers } from "./swish-layers";

// --- The typed-RPC Durable Object -----------------------------------------
// Its RPC schema is the swish `CounterRpcs`. The impl provides the engine move
// handlers + the six swish services (from this DO's storage/D1/KV) to the RPC
// server that runs on the DO's `fetch`.

export class CounterEngineDO extends Cloudflare.RpcDurableObject<CounterEngineDO>()(
	"CounterEngine",
	{ schema: CounterRpcs },
	Effect.gen( function* () {
		// init: nothing to bind up front.
		return Effect.gen( function* () {
			const state = yield* Cloudflare.DurableObjectState;
			const services = makeSwishLayers( state.raw.storage );
			return RpcServer.toHttpEffect( CounterRpcs ).pipe(
				Effect.provide( Layer.mergeAll(
					CounterRpcs.layer.pipe( Layer.provide( services ) ),
					RpcSerialization.layerNdjson
				) )
			);
		} );
	} )
) {}

// --- The alchemy Worker that serves the Effect HttpApi ---------------------

export default class EffectServer extends Cloudflare.Worker<EffectServer>()(
	"EffectServer",
	{ main: import.meta.url },
	Effect.gen( function* () {
		// init: bind the Durable Object namespace + build the two web handlers once.
		// Each handler's residual requirement is the per-request service passed as
		// the `context` arg below: `HttpAppContext` for auth, `CounterEngine` for counter.
		const counters = yield* CounterEngineDO;

		const authHandler = HttpRouter.toWebHandler(
			HttpApiBuilder.layer( AuthApi ).pipe(
				Layer.provide( AuthApiLive ),
				Layer.provide( HttpRouter.layer ),
				Layer.provide( HttpServer.layerServices )
			)
		);
		const counterHandler = HttpRouter.toWebHandler(
			HttpApiBuilder.layer( CounterApi ).pipe(
				Layer.provide( CounterApiLive ),
				Layer.provide( HttpRouter.layer ),
				Layer.provide( HttpServer.layerServices )
			)
		);

		// `CounterEngine` implemented by forwarding to the DO's typed RPC client.
		// Transport failures (`RpcClientError`) become defects; the engine's own
		// typed errors pass through unchanged.
		const counterEngine: typeof CounterEngine.Service = {
			initialize: ( gameId, payload ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.initialize( { id: gameId, code: payload.code, config: payload.config } )
						.pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) ),
			getState: ( gameId, playerInfo ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.getState( playerInfo ).pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) ),
			join: ( gameId, playerInfo ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.join( playerInfo ).pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) ),
			addBots: ( gameId ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.addBots( undefined ).pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) ),
			start: ( gameId ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.start( undefined ).pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) ),
			increment: ( gameId, playerInfo, input ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.increment( { playerInfo, input } ).pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) ),
			add: ( gameId, playerInfo, input ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.add( { playerInfo, input } ).pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) ),
			undo: ( gameId, playerInfo ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.undo( playerInfo ).pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) ),
			redo: ( gameId, playerInfo ) =>
				Effect.flatMap( counters.getByName( gameId ), ( client ) =>
					client.redo( playerInfo ).pipe( Effect.catchTag( "RpcClientError", ( e ) => Effect.die( e ) ) ) )
		};

		return {
			fetch: Effect.gen( function* () {
				const serverRequest = yield* HttpServerRequest.HttpServerRequest;
				const request = yield* HttpServerRequest.toWeb( serverRequest ).pipe( Effect.orDie );
				const url = new URL( request.url );

				if ( url.pathname.startsWith( "/auth" ) ) {
					const user = yield* Effect.promise(
						() => loadSession( request.headers.get( "Cookie" ) ?? "" )
					);
					const resHeaders = new Headers();
					const context = Context.make( HttpAppContext, {
						env,
						req: request,
						// Unwired demo: the real ExecutionContext isn't surfaced here and the
						// auth handlers never read it.
						ctx: undefined as unknown as ExecutionContext,
						user,
						resHeaders
					} );
					const response = yield* Effect.promise( () => authHandler.handler( request, context ) );
					resHeaders.forEach( ( value, key ) => response.headers.append( key, value ) );
					return HttpServerResponse.fromWeb( response );
				}

				if ( url.pathname.startsWith( "/counter" ) ) {
					const context = Context.make( CounterEngine, counterEngine );
					const response = yield* Effect.promise( () => counterHandler.handler( request, context ) );
					return HttpServerResponse.fromWeb( response );
				}

				return HttpServerResponse.empty( { status: 404 } );
			} )
		};
	} )
) {}
