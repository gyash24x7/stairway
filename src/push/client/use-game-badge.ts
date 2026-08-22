"use client";

import { useEffect } from "react";

import { MESSAGE_GAME_OPENED } from "@/push/shared/protocol.ts";

/**
 * Tells the service worker this game is being looked at, so its badge entry and
 * any notification still on screen are cleared.
 *
 * Runs on mount and whenever the tab comes back to the foreground: opening a
 * game from the notification is already handled by the worker's click handler,
 * but arriving any other way — a link, the lobby, switching back to a tab left
 * open — has to say so explicitly or the count sticks.
 *
 * @param gameId - The game being viewed.
 */
export function useGameBadge( gameId: string | undefined ) {
	useEffect( () => {
		if ( !gameId || typeof navigator === "undefined" || !( "serviceWorker" in navigator ) ) {
			return;
		}

		const notify = () => {
			if ( document.visibilityState !== "visible" ) {
				return;
			}

			navigator.serviceWorker.controller?.postMessage( {
				type: MESSAGE_GAME_OPENED,
				gameId
			} );
		};

		notify();
		document.addEventListener( "visibilitychange", notify );
		return () => document.removeEventListener( "visibilitychange", notify );
	}, [ gameId ] );
}
