/**
 * Captures the browser's install prompt outside React.
 *
 * `beforeinstallprompt` frequently fires before React has mounted, so a
 * listener registered in an effect misses it on a cold load and the install
 * button never appears. The listener therefore lives at module scope and the
 * event is held here until something asks for it.
 *
 * Shaped for `useSyncExternalStore`, which means `getInstallPrompt` must return
 * a *stable* reference — the event itself or `null`, never a fresh wrapper —
 * or React re-renders forever.
 */

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
	}

	interface Navigator {
		/** iOS Safari's pre-standard standalone flag. Absent in every other browser. */
		standalone?: boolean;
	}
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
	for ( const listener of listeners ) {
		listener();
	}
}

// Guarded because the test runner imports modules in a Bun context with no
// `window`; the SPA itself never server-renders.
if ( typeof window !== "undefined" ) {
	window.addEventListener( "beforeinstallprompt", event => {
		// Suppress Chrome's own mini-infobar so the app can offer install at a
		// moment of its choosing instead.
		event.preventDefault();
		deferred = event;
		emit();
	} );

	window.addEventListener( "appinstalled", () => {
		deferred = null;
		emit();
	} );
}

export function subscribeInstallPrompt( listener: () => void ) {
	listeners.add( listener );
	return () => {
		listeners.delete( listener );
	};
}

export function getInstallPrompt() {
	return deferred;
}

/** Server snapshot: there is no prompt outside a browser. */
export function getServerInstallPrompt() {
	return null;
}

/**
 * Shows the native install dialog. Resolves to whether the user accepted.
 *
 * The captured event is single-use — the browser will not accept a second
 * `prompt()` on it — so it is cleared either way.
 */
export async function promptInstall() {
	const event = deferred;
	if ( !event ) {
		return false;
	}

	deferred = null;
	emit();

	try {
		await event.prompt();
		const { outcome } = await event.userChoice;
		return outcome === "accepted";
	} catch {
		return false;
	}
}
