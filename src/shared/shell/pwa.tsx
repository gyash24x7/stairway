import { DownloadIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { Button } from "@/shared/primitives/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/primitives/popover";
import { toast } from "@/shared/primitives/sonner";
import { isIos, isStandalone } from "@/shared/shell/platform";


// --- Install -----------------------------------------------------------------

type InstallPromptEvent = Event & { prompt: () => Promise<{ outcome: "accepted" | "dismissed" }> };

let deferredPrompt: InstallPromptEvent | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach( listener => listener() );

/**
 * Chrome offers installation once, at load, through an event that has to be
 * caught before it is needed — so it is caught here, at import, rather than in
 * a component that may mount after it has already fired. Held on to, it is what
 * the install button replays.
 */
if ( typeof window !== "undefined" ) {
	window.addEventListener( "beforeinstallprompt", event => {
		event.preventDefault();
		deferredPrompt = event as InstallPromptEvent;
		notify();
	} );

	window.addEventListener( "appinstalled", () => {
		deferredPrompt = undefined;
		notify();
	} );
}

const subscribe = ( listener: () => void ) => {
	listeners.add( listener );
	return () => listeners.delete( listener );
};

/**
 * The navbar's install button. Shown when the browser has offered to install
 * the app, and on iOS — where nothing is ever offered — as directions to the
 * Share sheet instead. Hidden once the app is installed and running as one.
 */
export function InstallButton() {
	const prompt = useSyncExternalStore( subscribe, () => deferredPrompt, () => undefined );

	if ( isStandalone() ) {
		return null;
	}

	if ( prompt ) {
		const install = async () => {
			await prompt.prompt();
			deferredPrompt = undefined;
			notify();
		};

		return (
			<Button size={ "icon" } onClick={ install } title={ "Install the app" }>
				<DownloadIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
			</Button>
		);
	}

	if ( !isIos() ) {
		return null;
	}

	return (
		<Popover>
			<PopoverTrigger render={ <Button size={ "icon" } title={ "Install the app" }/> }>
				<DownloadIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
			</PopoverTrigger>
			<PopoverContent className={ "max-w-64 text-sm" }>
				Tap <b>Share</b>, then <b>Add to Home Screen</b>. Installed, Stairway opens full screen and
				can
				tell you when it's your turn.
			</PopoverContent>
		</Popover>
	);
}


// --- Updates and connectivity --------------------------------------------------

/**
 * Registers the service worker and offers each new version as it arrives.
 *
 * A new worker is never swapped in on its own: a page mid-game would find the
 * bundle under it replaced between two moves. It waits, and the player is
 * offered the reload — taking it is what tells the worker to take over
 * (`SKIP_WAITING` in `src/sw.ts`), after which the page reloads onto it.
 *
 * Checked again hourly, because an installed app can stay open for days and
 * only looks for a new worker when it navigates.
 */
export function PwaUpdates() {
	const { needRefresh: [ needRefresh ], updateServiceWorker } = useRegisterSW( {
		onRegisteredSW: ( _url, registration ) => {
			if ( registration ) {
				setInterval( () => void registration.update(), 60 * 60 * 1000 );
			}
		}
	} );

	// The worker marks the app icon when a notice arrives (`src/sw.ts`). Being
	// looked at is what answers it, so the mark goes whenever the app is shown.
	useEffect( () => {
		const badged = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
		const clear = () => {
			if ( document.visibilityState === "visible" ) {
				void badged.clearAppBadge?.().catch( () => undefined );
			}
		};

		clear();
		document.addEventListener( "visibilitychange", clear );

		return () => document.removeEventListener( "visibilitychange", clear );
	}, [] );

	useEffect( () => {
		if ( !needRefresh ) {
			return;
		}

		toast( "A new version of Stairway is ready.", {
			duration: Number.POSITIVE_INFINITY,
			action: { label: "RELOAD", onClick: () => void updateServiceWorker( true ) }
		} );

	}, [ needRefresh, updateServiceWorker ] );

	return null;
}

const subscribeOnline = ( listener: () => void ) => {
	window.addEventListener( "online", listener );
	window.addEventListener( "offline", listener );

	return () => {
		window.removeEventListener( "online", listener );
		window.removeEventListener( "offline", listener );
	};
};

/**
 * A strip across the bottom while the device has no connection. The shell still
 * opens offline, so without it a board would simply sit still with nothing to
 * say why; the games' own live views reconnect when the network is back.
 */
export function OfflineBanner() {
	const online = useSyncExternalStore( subscribeOnline, () => navigator.onLine, () => true );
	if ( online ) {
		return null;
	}

	return (
		<div
			className={ "fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-1 bg-accent text-sm" }>
			<WifiOffIcon className={ "w-4 h-4" }/>
			You're offline. Games will pick up where they left off when you reconnect.
		</div>
	);
}
