import { useEffect } from "react";


/**
 * Keeps the screen on while the calling component is mounted.
 *
 * For the two-screen games: a television showing the board, and the phone
 * driving it, both sit untouched for whole turns at a time — exactly what a
 * screen's idle timeout is for, and exactly when the table needs them awake.
 *
 * The browser releases a wake lock whenever the page is hidden, and does not
 * take it back on its own, so it is asked for again each time the page is
 * shown. Where the API is missing, or the request is refused (low battery, a
 * restrictive browser), the screen simply sleeps as it always did.
 */
export function useWakeLock() {
	useEffect( () => {
		if ( !( "wakeLock" in navigator ) ) {
			return;
		}

		let lock: WakeLockSentinel | undefined;
		let released = false;

		const acquire = async () => {
			if ( document.visibilityState !== "visible" || released ) {
				return;
			}
			try {
				lock = await navigator.wakeLock.request( "screen" );
			} catch {
				lock = undefined;
			}
		};

		void acquire();
		document.addEventListener( "visibilitychange", acquire );

		return () => {
			released = true;
			document.removeEventListener( "visibilitychange", acquire );
			void lock?.release();
		};
	}, [] );
}
