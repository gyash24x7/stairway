"use client";

import { useSyncExternalStore } from "react";
import { useMediaQuery } from "usehooks-ts";

import {
	getInstallPrompt,
	getServerInstallPrompt,
	promptInstall,
	subscribeInstallPrompt
} from "@/pwa/client/install-store.ts";

/**
 * iOS reports iPadOS as `MacIntel`, so a touch check is the only reliable tell.
 * Computed once: it cannot change for the life of the document.
 */
const isIos = typeof navigator !== "undefined" && (
	/iPad|iPhone|iPod/.test( navigator.userAgent )
	|| ( /Macintosh/.test( navigator.userAgent ) && navigator.maxTouchPoints > 1 )
);

/**
 * Everything the install affordance needs to decide what — if anything — to
 * offer.
 *
 * The two platforms differ enough that they cannot share one path: Chromium
 * fires `beforeinstallprompt` and can install programmatically, while iOS fires
 * nothing and has no API at all, so the only honest thing to show there is
 * instructions.
 */
export function useInstall() {
	const prompt = useSyncExternalStore(
		subscribeInstallPrompt,
		getInstallPrompt,
		getServerInstallPrompt
	);

	const isStandalone = useMediaQuery( "(display-mode: standalone)" )
		|| ( typeof navigator !== "undefined" && navigator.standalone === true );

	return {
		/** A native install dialog is available right now. */
		canPrompt: prompt !== null,
		/** Already running as an installed app, so there is nothing to offer. */
		isStandalone,
		isIos,
		install: promptInstall
	};
}
