import * as Exit from "effect/Exit";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import * as AsyncResult from "effect/reactivity/AsyncResult";

import { useCallback, useEffect, useState } from "react";

import type { SubscriptionInput } from "@/notifications/schema";
import { pushKeyAtom, subscribeAtom, unsubscribeAtom } from "@/notifications/ui/client";
import { isIos, isStandalone } from "@/shared/shell/platform";


/**
 * Where this device stands on notifications.
 * - unsupported: The browser has no Web Push at all
 * - needs-install: iOS, which only allows push from an app on the home screen
 * - unavailable: The server has no VAPID keys, so there is nothing to sign up to
 * - denied: The player blocked notifications; only the browser's settings undo it
 * - off / on: Whether this device is subscribed
 * - loading: Not worked out yet
 */
export type PushStatus =
	"unsupported"
	| "needs-install"
	| "unavailable"
	| "denied"
	| "off"
	| "on"
	| "loading";

const supported = () => typeof window !== "undefined"
	&& "serviceWorker" in navigator
	&& "PushManager" in window
	&& "Notification" in window;

/** A VAPID key arrives base64url; `pushManager.subscribe` wants the bytes. */
const keyBytes = ( base64url: string ) => {
	const base64 = ( base64url + "=".repeat( ( 4 - base64url.length % 4 ) % 4 ) )
		.replace( /-/g, "+" )
		.replace( /_/g, "/" );
	return Uint8Array.from( atob( base64 ), char => char.charCodeAt( 0 ) );
};

/**
 * Whether this page has already re-sent its subscription. Once per load is
 * enough to move the device to whoever is signed in, and every game page mounts
 * the hook, so without this each table visited would be another write.
 */
let synced = false;

const currentSubscription = async () => {
	const registration = await navigator.serviceWorker.ready;
	return registration.pushManager.getSubscription();
};

const toInput = ( subscription: PushSubscription ): SubscriptionInput => {
	const json = subscription.toJSON();
	return {
		endpoint: subscription.endpoint,
		expirationTime: subscription.expirationTime,
		keys: { p256dh: json.keys?.[ "p256dh" ] ?? "", auth: json.keys?.[ "auth" ] ?? "" }
	};
};

/**
 * Stops this device being told anything, on both ends: the server forgets it,
 * then the browser drops the subscription. In that order, because the request
 * needs the session cookie — which is why logout calls this *before* logging
 * out, so a shared device stops hearing about the previous player's games.
 *
 * Never throws: a device that cannot be unsubscribed is not a reason to keep
 * somebody logged in.
 */
export const useForgetDevice = () => {
	const unsubscribe = useAtomSet( unsubscribeAtom, { mode: "promiseExit" } );

	return useCallback( async () => {
		if ( !supported() ) {
			return;
		}
		try {
			const subscription = await currentSubscription();
			if ( subscription ) {
				await unsubscribe( subscription.endpoint );
				await subscription.unsubscribe();
			}
		} catch ( error ) {
			console.error( "Could not unsubscribe this device", error );
		}
	}, [ unsubscribe ] );
};

/**
 * Whether this device is signed up for notifications, and the two ways to
 * change that. `enable` must be called from a click: browsers only show the
 * permission prompt in answer to one.
 *
 * A device that is already subscribed is re-sent to the server once per page
 * load. That
 * is idempotent (an upsert on the endpoint), and it is what moves the device
 * to whoever is now signed in on it, and restores a row the server dropped.
 */
export const usePush = () => {
	const key = useAtomValue( pushKeyAtom );
	const subscribe = useAtomSet( subscribeAtom, { mode: "promiseExit" } );
	const forget = useForgetDevice();

	const publicKey = AsyncResult.isSuccess( key ) ? key.value.publicKey : undefined;
	const [ subscribed, setSubscribed ] = useState<boolean | undefined>( undefined );
	const [ busy, setBusy ] = useState( false );

	useEffect( () => {
		if ( !supported() ) {
			return;
		}

		let live = true;
		void currentSubscription().then( async subscription => {
			if ( subscription && Notification.permission === "granted" && !synced ) {
				synced = true;
				await subscribe( toInput( subscription ) );
			}
			if ( live ) {
				setSubscribed( subscription !== null );
			}
		} );

		return () => {
			live = false;
		};
	}, [ subscribe ] );

	const status: PushStatus = !supported()
		? isIos() && !isStandalone() ? "needs-install" : "unsupported"
		: publicKey === null
			? "unavailable"
			: typeof Notification !== "undefined" && Notification.permission === "denied"
				? "denied"
				: subscribed === undefined || publicKey === undefined
					? "loading"
					: subscribed ? "on" : "off";

	const enable = useCallback( async () => {
		if ( !publicKey ) {
			return false;
		}

		setBusy( true );

		try {
			const permission = await Notification.requestPermission();
			if ( permission !== "granted" ) {
				return false;
			}

			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.subscribe( {
				userVisibleOnly: true,
				applicationServerKey: keyBytes( publicKey )
			} );

			const exit = await subscribe( toInput( subscription ) );
			if ( Exit.isFailure( exit ) ) {
				await subscription.unsubscribe();
				return false;
			}

			setSubscribed( true );
			return true;
		} finally {
			setBusy( false );
		}
	}, [ publicKey, subscribe ] );

	const disable = useCallback( async () => {
		setBusy( true );
		try {
			await forget();
			setSubscribed( false );
		} finally {
			setBusy( false );
		}
	}, [ forget ] );

	return { status, busy, enable, disable } as const;
};
