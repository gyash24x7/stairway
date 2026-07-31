import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

/** Same base the typed HTTP client uses, switched to the ws(s) scheme. */
const WS_URL = API_URL.replace( /^http/, "ws" );

type GameSyncOptions = {
	/** The engine name (`structure.name`), e.g. `"wordle"` / `"tic-tac-toe"`. */
	gameName: string;
	gameId: string;
	playerId: string;
	/** The TanStack Query key holding this game's snapshot. */
	queryKey: QueryKey;
};

/**
 * Opens a realtime sync socket to `/sync/{gameName}/{gameId}?playerId={playerId}`.
 * The worker routes it to the `{gameName}:{gameId}` game channel, which pushes the
 * fresh per-audience `GameSnapshot` after every command. Each frame replaces the
 * cached snapshot at `queryKey`, so the game page (and its context) re-renders with
 * the latest state without a refetch. Reconnects automatically on drop.
 */
export function useGameSync( { gameName, gameId, playerId, queryKey }: GameSyncOptions ) {
	const queryClient = useQueryClient();
	const url = `${ WS_URL }sync/${ gameName }/${ gameId }?playerId=${ playerId }`;

	const { lastJsonMessage } = useWebSocket( url, { shouldReconnect: () => true } );

	useEffect( () => {
		if ( lastJsonMessage != null ) {
			queryClient.setQueryData( queryKey, lastJsonMessage );
		}
	}, [ lastJsonMessage ] );
}
