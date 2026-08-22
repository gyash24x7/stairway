import { registerSW } from "virtual:pwa-register";

import { toast } from "@/shared/ui/primitives/sonner.tsx";

/**
 * Registers the service worker and surfaces its two lifecycle moments through
 * the toaster the app already has.
 *
 * `registerType: "prompt"` means a freshly built worker installs but *waits*:
 * the running app keeps serving the precache it booted with, so an open tab
 * never has a lazy chunk pulled out from under it mid-game. `updateSW( true )`
 * is what releases it, and only a deliberate tap calls that.
 *
 * Uses the plain `registerSW` rather than the React binding because the root
 * route forks into a chrome branch and a full-bleed branch, so a component
 * would have to be mounted in both (the way `<Toaster/>` is) and could drift.
 * An imperative toast needs no mount point at all.
 *
 * Registration is left at the default `immediate: false`, which defers it to
 * `window.load` — comfortably after React has mounted the toaster, which
 * matters because sonner drops toasts published before a `<Toaster/>`
 * subscribes.
 */
export function registerServiceWorker() {
	const updateSW = registerSW( {
		onNeedRefresh: () => {
			toast( "A new version of Stairway is ready.", {
				duration: Infinity,
				action: {
					label: "RELOAD",
					onClick: () => void updateSW( true )
				}
			} );
		},
		onOfflineReady: () => {
			toast.success( "Ready to play offline." );
		}
	} );
}
