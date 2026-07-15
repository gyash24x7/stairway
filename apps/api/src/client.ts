// @s2h/api/client — the browser-safe typed client for the Stairway HttpApi.
//
// `getClient(baseUrl)` returns the Effect v4 `HttpApiClient` generated from the
// composed `StairwayAPI` (all games + auth + health). Each endpoint method
// returns an `Effect`; `run(effect, signal)` bridges it to a Promise for
// TanStack Query (queryFn/mutationFn), surfacing the *typed* failure (e.g.
// `GameNotFound`, `HttpApiError.BadRequest`) as the thrown error and forwarding
// the query's `AbortSignal` so cancellations interrupt the fetch.
//
// This module imports `StairwayAPI` — the pure endpoint *definition* (no
// handlers, DOs, db, or alchemy) — so it stays safe to bundle into the SPA.

import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { StairwayAPI } from "./api";

const build = ( baseUrl: string ) =>
	Effect.runSync(
		HttpApiClient.make( StairwayAPI, { baseUrl } ).pipe(
			Effect.provide( FetchHttpClient.layer )
		)
	);

// The generated client is stateless over a base URL, so build it once per URL.
declare let client: ReturnType<typeof build>;

export function getClient( baseUrl: string ) {
	if ( !client ) {
		client = build( baseUrl );
	}
	return client;
}

/**
 * Run a client Effect as a Promise for TanStack Query. Forwards the query's
 * `AbortSignal` (interruption aborts the fetch) and, on failure, throws the
 * domain error itself rather than a wrapping `FiberFailure` so `error` in the
 * query/mutation is the tagged error the endpoint declares.
 */
export function run<A, E>( effect: Effect.Effect<A, E>, signal?: AbortSignal ) {
	return Effect.runPromiseExit( effect, { signal } ).then( ( exit ) => {
		if ( Exit.isSuccess( exit ) ) {
			return exit.value;
		}
		// Collapse the cause to the typed failure (or defect) so the query's
		// `error` is the tagged endpoint error, not a wrapping FiberFailure.
		throw Cause.squash( exit.cause );
	} );
}
