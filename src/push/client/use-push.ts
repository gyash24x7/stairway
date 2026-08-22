"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribePushFn, unsubscribePushFn } from "@/push/client/client.ts";
import { urlBase64ToUint8Array } from "@/push/client/keys.ts";

const VAPID_PUBLIC_KEY = import.meta.env[ "VITE_VAPID_PUBLIC_KEY" ] ?? "";

/** Whether this browser can do web push at all. */
const supported = typeof navigator !== "undefined"
	&& "serviceWorker" in navigator
	&& typeof window !== "undefined"
	&& "PushManager" in window
	&& "Notification" in window
	&& !!VAPID_PUBLIC_KEY;

const isIos = typeof navigator !== "undefined" && (
	/iPad|iPhone|iPod/.test( navigator.userAgent )
	|| ( /Macintosh/.test( navigator.userAgent ) && navigator.maxTouchPoints > 1 )
);

function isStandalone() {
	if ( typeof window === "undefined" ) {
		return false;
	}

	return window.matchMedia( "(display-mode: standalone)" ).matches
		|| navigator.standalone === true;
}

/**
 * The browser half of turn notifications.
 *
 * Two rules shape this hook. Nothing here ever prompts on mount — a permission
 * dialog nobody asked for is the fastest way to get permanently denied — so
 * `enable()` is only ever reachable from a click. And on iOS, web push simply
 * does not exist until the site is installed to the Home Screen, so the hook
 * reports `needsInstall` rather than offering a button that cannot work.
 */
export function usePush() {
	const [ permission, setPermission ] = useState<NotificationPermission>(
		() => supported ? Notification.permission : "default"
	);
	const [ deviceCount, setDeviceCount ] = useState( 0 );
	const [ subscribed, setSubscribed ] = useState( false );
	const [ isBusy, setIsBusy ] = useState( false );

	/**
	 * Re-registers the current subscription on load, without ever prompting.
	 *
	 * This is what closes the gap left by storing every device under one KV key:
	 * a device dropped by two registrations racing reappears on the next page
	 * load. It also refreshes the record's TTL, so an app in regular use never
	 * ages out.
	 */
	useEffect( () => {
		if ( !supported || Notification.permission !== "granted" ) {
			return;
		}

		let cancelled = false;

		void ( async() => {
			try {
				const registration = await navigator.serviceWorker.ready;
				const subscription = await registration.pushManager.getSubscription();
				if ( !subscription || cancelled ) {
					return;
				}

				const status = await subscribePushFn(
					subscription.toJSON() as Parameters<typeof subscribePushFn>[ 0 ]
				);

				if ( !cancelled ) {
					setSubscribed( true );
					setDeviceCount( status.deviceCount );
				}
			} catch {
				// Offline, or the session has lapsed. Neither is worth surfacing:
				// nothing the user did failed.
			}
		} )();

		return () => {
			cancelled = true;
		};
	}, [] );

	const enable = useCallback( async() => {
		if ( !supported ) {
			return false;
		}

		setIsBusy( true );
		try {
			const granted = await Notification.requestPermission();
			setPermission( granted );
			if ( granted !== "granted" ) {
				return false;
			}

			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.subscribe( {
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array( VAPID_PUBLIC_KEY )
			} );

			const status = await subscribePushFn(
				subscription.toJSON() as Parameters<typeof subscribePushFn>[ 0 ]
			);

			setSubscribed( true );
			setDeviceCount( status.deviceCount );
			return true;
		} catch {
			return false;
		} finally {
			setIsBusy( false );
		}
	}, [] );

	const disable = useCallback( async() => {
		if ( !supported ) {
			return;
		}

		setIsBusy( true );
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			if ( !subscription ) {
				setSubscribed( false );
				return;
			}

			const { endpoint } = subscription;
			await subscription.unsubscribe();
			const status = await unsubscribePushFn( endpoint );

			setSubscribed( false );
			setDeviceCount( status.deviceCount );
		} catch {
			// Leaving a stale subscription registered is harmless: the first send
			// to it returns 410 and the server prunes it.
		} finally {
			setIsBusy( false );
		}
	}, [] );

	return {
		supported,
		permission,
		subscribed,
		deviceCount,
		isBusy,
		/** iOS, and not installed — push is unreachable until it is. */
		needsInstall: supported && isIos && !isStandalone(),
		enable,
		disable
	};
}
