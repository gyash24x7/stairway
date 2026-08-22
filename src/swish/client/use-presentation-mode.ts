"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Puts the couch screen into true fullscreen, landscape-locked where the
 * browser allows it.
 *
 * The ordering is not a preference: Chrome rejects an orientation lock taken
 * outside fullscreen, so the lock has to wait for `requestFullscreen()` to
 * resolve. The lock is then allowed to fail on its own — iOS Safari has no
 * `screen.orientation.lock` and desktop refuses it outright — because
 * fullscreen alone is still most of the benefit.
 *
 * Entering must be driven by a real gesture; browsers refuse both calls
 * otherwise. Nothing here touches `CouchCanvas`'s scaling: that derives from
 * `useWindowSize`, and both going fullscreen and rotating fire `resize`, so the
 * canvas rescales itself.
 */
export function usePresentationMode() {
	const [ active, setActive ] = useState( false );

	useEffect( () => {
		const onChange = () => setActive( !!document.fullscreenElement );
		document.addEventListener( "fullscreenchange", onChange );
		return () => document.removeEventListener( "fullscreenchange", onChange );
	}, [] );

	const enter = useCallback( async() => {
		const target = document.documentElement;
		if ( !target.requestFullscreen ) {
			return;
		}

		try {
			await target.requestFullscreen();
		} catch {
			// Refused — no gesture, or policy. Nothing else to try.
			return;
		}

		try {
			await screen.orientation?.lock?.( "landscape" );
		} catch {
			// Unsupported on iOS and on desktop; fullscreen alone is fine.
		}
	}, [] );

	const exit = useCallback( async() => {
		try {
			screen.orientation?.unlock?.();
		} catch {
			// Never locked in the first place.
		}

		try {
			await document.exitFullscreen?.();
		} catch {
			// Already out.
		}
	}, [] );

	return {
		supported: typeof document !== "undefined"
			&& !!document.documentElement.requestFullscreen,
		active,
		enter,
		exit,
		toggle: useCallback(
			() => active ? void exit() : void enter(),
			[ active, enter, exit ]
		)
	};
}
