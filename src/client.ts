import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";
import type { AuthInfo } from "@/auth/shared/schema.ts";
import { StairwayAPI } from "@/api.ts";

const build = ( baseUrl: string ) =>
	Effect.runSync(
		HttpApiClient.make( StairwayAPI, { baseUrl } ).pipe(
			Effect.provide( FetchHttpClient.layer ),
			Effect.provideService( FetchHttpClient.RequestInit, { credentials: "include" } )
		)
	);

// The generated client is stateless over a base URL, so build it once per URL.
let client: ReturnType<typeof build> | undefined;

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
export async function run<A, E>( effect: Effect.Effect<A, E>, signal?: AbortSignal ) {
	const exit = await Effect.runPromiseExit( effect, { signal } );
	if ( Exit.isSuccess( exit ) ) {
		return exit.value;
	}

	throw Cause.squash( exit.cause );
}

/** Turn the logged-in `AuthInfo` into the `PlayerInfo` payload the API expects. */
export const toPlayerInfo = ( authInfo: AuthInfo ) => PlayerInfo.make( {
	id: PlayerId.make( authInfo.id ),
	name: authInfo.name,
	avatar: authInfo.avatar,
	isBot: false
} );
