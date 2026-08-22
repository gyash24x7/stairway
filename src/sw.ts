/// <reference lib="webworker" />

import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";

import { BADGE_CACHE, BADGE_KEY, MESSAGE_GAME_OPENED } from "@/push/shared/protocol.ts";

import type { PushMessage } from "@/push/shared/protocol.ts";

/**
 * The Stairway service worker: app-shell caching *and* push notifications in one
 * file, because `vite-plugin-pwa` can only compile one.
 *
 * This is built with the `injectManifest` strategy rather than `generateSW`,
 * which is not a stylistic choice: `generateSW` emits a Workbox-authored worker
 * with no seam for custom code, so a `push` listener is impossible under it.
 * The cost is that precaching and runtime caching, which `generateSW` would
 * configure for us, have to be wired up by hand below.
 *
 * Deliberately absent: any caching of the API. The API is a *separate Worker on
 * a different origin* (`VITE_API_URL`), so a worker registered here cannot see
 * those requests at all — and a handler that did intercept them would risk
 * replaying without `credentials: "include"` against a `SameSite=None` session
 * cookie, silently signing every user out. WebSockets bypass service workers
 * entirely, so game sync is untouched by anything here.
 */

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

precacheAndRoute( self.__WB_MANIFEST );

/**
 * Deep links have to boot the SPA. The asset layer is configured for
 * single-page-application not-found handling too (see `alchemy.run.ts`); this is
 * the same rule applied while offline, where the asset layer is unreachable.
 */
registerRoute( new NavigationRoute(
	createHandlerBoundToURL( "/index.html" ),
	{ denylist: [ /^\/api\// ] }
) );

/**
 * Google Fonts, in two halves — the stylesheet changes, the font files never do.
 *
 * `src/styles.css` imports Bungee, Oswald and Merriweather Sans over the network
 * and that import survives into the built CSS, so without these two rules every
 * custom face falls back offline. On a display-type-driven design that is the
 * single most visible thing that can go wrong.
 */
registerRoute(
	( { url } ) => url.origin === "https://fonts.googleapis.com",
	new StaleWhileRevalidate( { cacheName: "google-fonts-stylesheets" } )
);

registerRoute(
	( { url } ) => url.origin === "https://fonts.gstatic.com",
	new CacheFirst( {
		cacheName: "google-fonts-webfonts",
		plugins: [
			// Cross-origin font files answer a plain <link> with an *opaque*
			// response (status 0). Without this the cache silently stores nothing.
			new CacheableResponsePlugin( { statuses: [ 0, 200 ] } ),
			new ExpirationPlugin( { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 } )
		]
	} )
);

/**
 * Card faces and Splendor tokens: 1.8 MB across 60-odd files, deliberately kept
 * out of the precache. You cannot create or join a game offline anyway, so this
 * only has to make the *second* game of the evening instant.
 */
registerRoute(
	( { url, sameOrigin } ) => sameOrigin && /^\/(cards|splendor)\//.test( url.pathname ),
	new CacheFirst( {
		cacheName: "stairway-game-art",
		plugins: [
			new ExpirationPlugin( { maxEntries: 96, maxAgeSeconds: 60 * 60 * 24 * 30 } )
		]
	} )
);

registerRoute(
	( { url } ) => url.origin === "https://api.dicebear.com",
	new CacheFirst( {
		cacheName: "stairway-avatars",
		plugins: [
			new CacheableResponsePlugin( { statuses: [ 0, 200 ] } ),
			new ExpirationPlugin( { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } )
		]
	} )
);

// ---------------------------------------------------------------------------
// Badge bookkeeping
// ---------------------------------------------------------------------------

/**
 * Which games are waiting on this user, kept in the Cache API.
 *
 * The count lives here rather than on the server because there is no
 * server-side source of truth for it: turn state exists only inside each game's
 * Durable Object, never in D1, so an aggregate would mean a durable write on
 * every turn handover of every game — forever, for a cosmetic integer. And since
 * a badge is only useful while the app is *closed*, the worker would have to
 * fetch it on every push regardless. The day a "my games" screen exists, the
 * badge becomes a free by-product of it; until then, local is both cheaper and
 * more accurate.
 *
 * The Cache API is used over IndexedDB purely because it needs no schema
 * versioning for what is a few hundred bytes.
 */
type BadgeEntry = { readonly game: string; readonly at: number };
type BadgeState = Record<string, BadgeEntry>;

const MAX_BADGE_AGE_MS = 24 * 60 * 60 * 1000;

async function readBadgeState() {
	try {
		const cache = await caches.open( BADGE_CACHE );
		const stored = await cache.match( BADGE_KEY );
		if ( !stored ) {
			return {} as BadgeState;
		}

		return await stored.json() as BadgeState;
	} catch {
		return {} as BadgeState;
	}
}

async function writeBadgeState( state: BadgeState ) {
	const count = Object.keys( state ).length;

	try {
		const cache = await caches.open( BADGE_CACHE );
		await cache.put( BADGE_KEY, new Response( JSON.stringify( state ), {
			headers: { "content-type": "application/json" }
		} ) );
	} catch {
		// A full or unavailable cache must not stop the notification showing.
	}

	try {
		if ( count > 0 ) {
			await self.navigator.setAppBadge?.( count );
		} else {
			await self.navigator.clearAppBadge?.();
		}
	} catch {
		// Badging is unsupported on most desktop browsers; never a failure.
	}
}

/** Drops games nobody has looked at in a day so an abandoned table cannot pin the badge. */
function sweep( state: BadgeState, now: number ) {
	return Object.fromEntries(
		Object.entries( state ).filter( ( [ , entry ] ) => now - entry.at < MAX_BADGE_AGE_MS )
	);
}

async function addBadge( gameId: string, game: string ) {
	const now = Date.now();
	const state = sweep( await readBadgeState(), now );
	await writeBadgeState( { ...state, [ gameId ]: { game, at: now } } );
}

async function clearBadge( gameId: string ) {
	const state = await readBadgeState();
	if ( !( gameId in state ) ) {
		return;
	}

	const { [ gameId ]: _removed, ...rest } = state;
	await writeBadgeState( rest );
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

function parsePush( event: PushEvent ) {
	try {
		return event.data?.json() as PushMessage;
	} catch {
		return undefined;
	}
}

self.addEventListener( "push", event => {
	const message = parsePush( event );

	// `userVisibleOnly: true` means a push that shows nothing is a
	// permission-revocation offence in Chrome, so a malformed payload still has
	// to put *something* on screen.
	const title = message?.title ?? "Stairway";
	const body = message?.body ?? "It's your turn.";
	const url = message?.url ?? "/";
	const tag = message ? `${ message.game }:${ message.gameId }` : "stairway";

	event.waitUntil( ( async() => {
		await self.registration.showNotification( title, {
			body,
			// `tag` replaces an earlier notice for the same table rather than
			// stacking; `renotify` makes that replacement still alert, instead of
			// swapping silently. The cast is only because TypeScript's lib has not
			// caught up with `renotify` — it is a shipped part of the spec.
			tag,
			renotify: true,
			icon: "/pwa-192x192.png",
			badge: "/pwa-64x64.png",
			data: { url, gameId: message?.gameId, game: message?.game }
		} as NotificationOptions & { renotify: boolean } );

		if ( message?.gameId ) {
			await addBadge( message.gameId, message.game );
		}
	} )() );
} );

self.addEventListener( "notificationclick", event => {
	event.notification.close();

	const data = event.notification.data as { url?: string; gameId?: string } | undefined;
	const url = data?.url ?? "/";

	event.waitUntil( ( async() => {
		if ( data?.gameId ) {
			await clearBadge( data.gameId );
		}

		const clientList = await self.clients.matchAll( {
			type: "window",
			includeUncontrolled: true
		} );

		// Reuse a window if one is open — a second window on the same game would
		// open a second socket into the same Durable Object.
		for ( const client of clientList ) {
			if ( "focus" in client ) {
				await client.focus();
				if ( "navigate" in client ) {
					await client.navigate( url );
				}
				return;
			}
		}

		await self.clients.openWindow( url );
	} )() );
} );

/**
 * Dismissing counts as acknowledgement. The alternative — keeping the badge
 * until the game is opened — strands the count whenever someone plays the turn
 * on another device, which is the common case for a phone/TV setup.
 */
self.addEventListener( "notificationclose", event => {
	const data = event.notification.data as { gameId?: string } | undefined;
	if ( data?.gameId ) {
		event.waitUntil( clearBadge( data.gameId ) );
	}
} );

/** The authoritative clear: the page telling us the user is looking at the game. */
self.addEventListener( "message", event => {
	const data = event.data as { type?: string; gameId?: string } | undefined;
	if ( data?.type !== MESSAGE_GAME_OPENED || !data.gameId ) {
		return;
	}

	const { gameId } = data;
	event.waitUntil( ( async() => {
		await clearBadge( gameId );
		const shown = await self.registration.getNotifications();
		for ( const notification of shown ) {
			const notificationData = notification.data as { gameId?: string } | undefined;
			if ( notificationData?.gameId === gameId ) {
				notification.close();
			}
		}
	} )() );
} );

/**
 * Push services rotate endpoints on their own schedule. Re-subscribing here
 * keeps a device reachable without waiting for the user to open the app; if the
 * POST fails (some browsers withhold cookies from worker-context fetches), the
 * page-side sync on next load repairs it.
 */
self.addEventListener( "pushsubscriptionchange", event => {
	event.waitUntil( ( async() => {
		const applicationServerKey = import.meta.env[ "VITE_VAPID_PUBLIC_KEY" ];
		const apiUrl = import.meta.env[ "VITE_API_URL" ];
		if ( !applicationServerKey || !apiUrl ) {
			return;
		}

		try {
			const subscription = await self.registration.pushManager.subscribe( {
				userVisibleOnly: true,
				applicationServerKey
			} );

			await fetch( `${ apiUrl }/api/push/subscribe`, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify( subscription.toJSON() )
			} );
		} catch {
			// Repaired by the page on next load.
		}
	} )() );
} );

self.addEventListener( "install", () => {
	// `skipWaiting` is deliberately NOT called: a running game must never have a
	// lazy chunk swapped out from under it. `registerType: "prompt"` puts that
	// decision in the user's hands via the update toast.
} );

self.addEventListener( "activate", () => {
	void self.clients.claim();
} );
