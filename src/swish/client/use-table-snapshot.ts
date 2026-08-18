"use client";

import { useQuery } from "@tanstack/react-query";

import { useGameSync } from "@/client.ts";

import type { GameId } from "@/swish/shared/schema.ts";

export type UseTableSnapshotOptions<Snapshot> = {
	/** The engine name (`structure.name`), e.g. `"splendor"`. */
	gameName: string;
	gameId: GameId;
	getTableState: ( gameId: GameId, signal?: AbortSignal ) => Promise<Snapshot>;
	/** Hold the read back until the session is known — it is session-gated server-side. */
	enabled?: boolean;
};

/**
 * The couch analogue of a game page's `useQuery` + socket overlay: loads the table
 * snapshot over HTTP so the television paints immediately, then keeps it live from
 * the game channel's table stream.
 *
 * The cache key is deliberately distinct from the player snapshot's
 * `[ gameName, "getState", gameId ]`. A table frame must never be able to clobber a
 * player snapshot, and both are legitimately open at once — the host commonly
 * drives the TV in one tab and plays their own seat in another.
 */
export function useTableSnapshot<Snapshot>( {
	gameName,
	gameId,
	getTableState,
	enabled = true
}: UseTableSnapshotOptions<Snapshot> ) {
	const queryKey = [ gameName, "getTableState", gameId ];

	const query = useQuery( {
		queryKey,
		enabled,
		queryFn: ( { signal } ) => getTableState( gameId, signal )
	} );

	// No `playerId`: the channel attaches a `TableAudience` to this socket. The key
	// must be omitted rather than passed as undefined — `exactOptionalPropertyTypes`.
	useGameSync( { gameName, gameId, queryKey } );

	return query;
}
