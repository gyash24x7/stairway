import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import type { GameFrame } from "@/shared/swish/schema.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

/** Same base the typed HTTP client uses, switched to the ws(s) scheme. */
const WS_URL = API_URL.replace( /^http/, "ws" );

/**
 * Joins a path onto the websocket base, tolerating a base with or without a
 * trailing slash — alchemy injects `VITE_API_URL` with one, the dev fallback has
 * none, and bare concatenation silently produced `ws://localhost:8787sync/…`.
 *
 * @param path - The path to append, without a leading slash.
 * @returns The absolute websocket url.
 */
export const wsUrl = ( path: string ) => `${ WS_URL.replace( /\/$/, "" ) }/${ path }`;

type GameSyncOptions = {
	/** The engine name (`structure.name`), e.g. `"wordle"` / `"tic-tac-toe"`. */
	gameName: string;
	gameId: string;
	/**
	 * The seated player's id — the controller/phone stream. **Omit** for the shared
	 * table (couch/TV) stream: the socket then carries no player identity and the
	 * channel attaches a `TableAudience`. Either way a valid session is required.
	 */
	playerId?: string;
	/** The TanStack Query key holding this game's snapshot. */
	queryKey: QueryKey;
};

/**
 * Opens a realtime sync socket to `/sync/{gameName}/{gameId}`, optionally scoped to
 * a player with `?playerId=`. The worker routes it to the `{gameName}:{gameId}` game
 * channel, which pushes the fresh per-audience `GameSnapshot` after every command.
 * Each frame replaces the cached snapshot at `queryKey`, so the page (and its
 * context) re-renders with the latest state without a refetch. Reconnects on drop.
 */
export function useGameSync( { gameName, gameId, playerId, queryKey }: GameSyncOptions ) {
	const queryClient = useQueryClient();
	const url = wsUrl( `sync/${ gameName }/${ gameId }` )
		+ ( playerId ? `?playerId=${ playerId }` : "" );

	const { lastJsonMessage } = useWebSocket( url, { shouldReconnect: () => true } );

	useEffect( () => {
		if ( lastJsonMessage == null ) {
			return;
		}

		// Frames are tagged. A tab still running the previous bundle can reconnect
		// after a deploy and receive the old bare-snapshot shape, so accept both for
		// one release — `swish/GameSnapshot` is itself discriminating.
		const frame = lastJsonMessage as GameFrame | { _tag?: string } | null;
		const snapshot = frame?._tag === "swish/Frame"
			? ( frame as GameFrame ).snapshot
			: frame?._tag === "swish/GameSnapshot" ? frame : null;

		if ( snapshot != null ) {
			queryClient.setQueryData( queryKey, snapshot );
		}
	}, [ lastJsonMessage ] );
}
