/// <reference lib="webworker" />

import { ExpirationPlugin } from "workbox-expiration";
import {
	cleanupOutdatedCaches,
	createHandlerBoundToURL,
	precacheAndRoute
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

import type { Notice } from "@/swish/server/notifier";

const assetsRegex = /^\/(cards|logos|splendor)\//;

declare const self: ServiceWorkerGlobalScope;

/**
 * The app shell: the hashed bundles, `index.html` and the icons, as listed by
 * vite-plugin-pwa at build time. This is what lets an installed app open with
 * no network at all, and what an update replaces wholesale.
 */
precacheAndRoute( self.__WB_MANIFEST );
cleanupOutdatedCaches();

/**
 * Every client route is the SPA, so a navigation is answered with the cached
 * `index.html` and the router takes it from there.
 *
 * `/api` is denied, and there is deliberately no other route for it: a game is
 * a live, server-authoritative stream, and a cached view of one is a board that
 * lies. A request that cannot reach the server fails, and `withReconnect` in
 * `@/swish/ui/live-view` is what retries it.
 */
registerRoute( new NavigationRoute(
	createHandlerBoundToURL( "index.html" ),
	{ denylist: [ /^\/api\// ] }
) );

/**
 * Every other hashed bundle — the arena's lazy Pixi chunks, mostly. A hashed
 * name is never reused for different bytes, so the first copy fetched is good
 * for as long as anything asks for it, and the arena opens offline once it has
 * been visited online. Capped, so bundles from old releases age out.
 */
registerRoute(
	( { url } ) => url.origin === self.location.origin && url.pathname.startsWith( "/assets/" ),
	new CacheFirst( {
		cacheName: "bundles",
		plugins: [ new ExpirationPlugin( { maxEntries: 60, purgeOnQuotaError: true } ) ]
	} )
);

/**
 * Card faces, logos and tiles never change under the same name, and a game
 * draws dozens of them, so once fetched they are served from the cache. Capped,
 * because seven games' worth of art is more than one player ever looks at.
 */
registerRoute(
	( { url } ) => url.origin === self.location.origin && assetsRegex.test( url.pathname ),
	new CacheFirst( {
		cacheName: "art",
		plugins: [
			new ExpirationPlugin( { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 } )
		]
	} )
);

/**
 * A new worker waits rather than taking over, so a game in progress is never
 * swapped onto a different bundle mid-move. The page asks for the switch when
 * the player accepts the "new version" prompt (`@/shared/shell/pwa`).
 */
self.addEventListener( "message", event => {
	if ( event.data?.type === "SKIP_WAITING" ) {
		void self.skipWaiting();
	}
} );

/**
 * Every push is shown. The engine already leaves out anybody watching the game
 * (`watchers`, in `@/swish/server/engine`), and a push that shows nothing is
 * one Safari counts against the subscription and eventually revokes it for.
 *
 * `tag` is the game, so a newer notice about a table replaces the older one
 * instead of stacking — "your turn" then "game over" leaves just "game over".
 *
 * The app icon is marked as well, where the platform has badges: a dot rather
 * than a count, because the worker cannot know how many of the notices it has
 * shown are still waiting on the player. Opening the app clears it
 * (`PwaUpdates`).
 */
self.addEventListener( "push", event => {
	const payload = parsePayload( event.data );
	const badged = navigator as Navigator & { setAppBadge?: () => Promise<void> };

	event.waitUntil( Promise.all( [
		self.registration.showNotification( payload.title, {
			body: payload.body,
			icon: "/pwa/pwa-192x192.png",
			badge: "/pwa/badge-96x96.png",
			tag: payload.tag,
			renotify: true,
			data: { url: payload.url }
		} as NotificationOptions ),

		badged.setAppBadge?.().catch( () => undefined )
	] ) );
} );

/**
 * Opens the game the notice was about, in the window the app already has if
 * there is one: a second window would be a second live subscription to the
 * same table.
 */
self.addEventListener( "notificationclick", event => {
	event.notification.close();
	const url = new URL( event.notification.data?.url ?? "/", self.location.origin ).href;

	event.waitUntil( ( async () => {
		const windows = await self.clients.matchAll( { type: "window", includeUncontrolled: true } );
		const open = windows.find( client => new URL( client.url ).origin === self.location.origin );
		if ( !open ) {
			await self.clients.openWindow( url );
			return;
		}
		const focused = await open.focus();
		await focused.navigate( url );
	} )() );
} );

/**
 * A push service may rotate a subscription on its own. The new one is handed
 * to the server here, where the session cookie still identifies the player, so
 * notices keep arriving without them ever opening the app again.
 */
self.addEventListener( "pushsubscriptionchange", ( event: Event ) => {
	const change = event as Event & {
		oldSubscription?: PushSubscription;
		newSubscription?: PushSubscription;
		waitUntil: ( promise: Promise<unknown> ) => void;
	};

	change.waitUntil( ( async () => {
		const options = change.oldSubscription?.options;
		const subscription = change.newSubscription ?? (
			options ? await self.registration.pushManager.subscribe( options ) : undefined
		);

		if ( !subscription ) {
			return;
		}

		await fetch( "/api/notifications/subscription", {
			method: "PUT",
			credentials: "include",
			headers: { "content-type": "application/json" },
			body: JSON.stringify( subscription.toJSON() )
		} );
	} )() );
} );

/**
 * Reads a push's JSON. A push the server did not send in this shape still has
 * to show something (see above), so it falls back to a generic notice.
 */
function parsePayload( data: PushMessageData | null ): Notice {
	const fallback = {
		title: "Stairway",
		body: "Something happened in one of your games.",
		url: "/",
		tag: "stairway"
	};
	
	try {
		const payload = data?.json() as Partial<Notice> | undefined;
		return typeof payload?.title === "string" ? { ...fallback, ...payload } : fallback;
	} catch {
		return fallback;
	}
}
