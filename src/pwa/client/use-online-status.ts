"use client";

import { useSyncExternalStore } from "react";

// Module scope so the reference is stable: a subscribe function recreated per
// render makes `useSyncExternalStore` tear down and resubscribe every time.
function subscribe( onChange: () => void ) {
	window.addEventListener( "online", onChange );
	window.addEventListener( "offline", onChange );
	return () => {
		window.removeEventListener( "online", onChange );
		window.removeEventListener( "offline", onChange );
	};
}

function getSnapshot() {
	return navigator.onLine;
}

function getServerSnapshot() {
	return true;
}

/**
 * Whether the browser believes it has a network.
 *
 * `navigator.onLine` only reports link-layer state, so a captive portal or a
 * dead Durable Object both still read as online. It is the right signal for
 * "the whole app is offline" and the wrong one for "this game stopped
 * updating" — the honest source for the latter is the game socket's
 * `readyState`, which `useGameSync` already receives.
 */
export function useOnlineStatus() {
	return useSyncExternalStore( subscribe, getSnapshot, getServerSnapshot );
}
