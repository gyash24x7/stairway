import { useQueryClient } from "@tanstack/react-query";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { useEffect, useRef } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import type { QueryKey } from "@tanstack/react-query";

import { StairwayAPI } from "@/api.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";
const WS_URL = API_URL.replace( /^http/, "ws" );

export const client = Effect.runSync(
	HttpApiClient.make( StairwayAPI, { baseUrl: API_URL } ).pipe(
		Effect.provide( FetchHttpClient.layer ),
		Effect.provideService( FetchHttpClient.RequestInit, { credentials: "include" } )
	)
);

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

export const wsUrl = ( path: string ) => `${ WS_URL.replace( /\/$/, "" ) }/${ path }`;

type GameSyncOptions = {
	gameName: string;
	gameId: string;
	playerId?: string;
	queryKey: QueryKey;
};

/**
 * Overlays a game's query entry with whatever the game channel pushes.
 *
 * The key is held in a ref so a fresh array on every render cannot re-fire the
 * effect, and it is re-pointed on every render so the ref cannot outlive the
 * game it was captured for. Both halves matter: a route that swaps one game id
 * for another without remounting would otherwise keep writing the new game's
 * frames into the old game's entry, and the board would simply stop moving.
 */
export function useGameSync( { gameName, gameId, playerId, queryKey }: GameSyncOptions ) {
	const target = useRef( queryKey );
	target.current = queryKey;

	const queryClient = useQueryClient();
	const url = wsUrl( `${ gameName }/${ gameId }` )
		+ ( playerId ? `?playerId=${ playerId }` : "" );

	const { lastJsonMessage } = useWebSocket( url, { shouldReconnect: () => true } );

	useEffect( () => {
		if ( lastJsonMessage !== null ) {
			queryClient.setQueryData( target.current, lastJsonMessage );
		}
	}, [ lastJsonMessage, queryClient ] );
}
