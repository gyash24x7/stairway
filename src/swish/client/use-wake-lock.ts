"use client";

import { useEffect } from "react";

/**
 * Holds a screen wake lock while mounted, re-acquiring it whenever the tab comes
 * back to the foreground (the browser drops the lock on every visibility change).
 *
 * Feature-detected and fully best-effort: a `NotAllowedError` on an unfocused or
 * background tab is normal, not a bug, so every call is swallowed. Browsers with
 * no Wake Lock API simply get nothing.
 *
 * @param enabled - Whether to hold the lock. Pass `false` to release it.
 */
export function useWakeLock( enabled = true ) {
	useEffect( () => {
		if ( !enabled || typeof navigator === "undefined" || !navigator.wakeLock ) {
			return;
		}

		let sentinel: WakeLockSentinel | undefined;
		let released = false;

		const acquire = async () => {
			if ( released || document.visibilityState !== "visible" ) {
				return;
			}

			try {
				sentinel = await navigator.wakeLock.request( "screen" );
			} catch {
				// Backgrounded or blocked by policy — nothing to do but carry on.
			}
		};

		const onVisibilityChange = () => {
			if ( document.visibilityState === "visible" ) {
				void acquire();
			}
		};

		void acquire();
		document.addEventListener( "visibilitychange", onVisibilityChange );

		return () => {
			released = true;
			document.removeEventListener( "visibilitychange", onVisibilityChange );
			void sentinel?.release().catch( () => undefined );
		};
	}, [ enabled ] );
}
