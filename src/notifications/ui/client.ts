import * as Effect from "effect/Effect";

import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";

import { NotificationsApi } from "@/notifications/contract";
import type { SubscriptionInput } from "@/notifications/schema";


export class ApiClient extends AtomHttpApi.Service<ApiClient>()(
	"notifications/ApiClient",
	{ api: NotificationsApi, httpClient: FetchHttpClient.layer }
) {}

/** The VAPID public key, or `null` when this server sends no pushes. */
export const pushKeyAtom = ApiClient.query( "notifications", "key", {} );

/** Hands this device's subscription to the server, under the caller's account. */
export const subscribeAtom = ApiClient.runtime.fn(
	Effect.fnUntraced( function* ( payload: SubscriptionInput ) {
		const client = yield* ApiClient;
		return yield* client.notifications.subscribe( { payload } );
	} )
);

/** Tells the server to stop sending to this device. */
export const unsubscribeAtom = ApiClient.runtime.fn(
	Effect.fnUntraced( function* ( endpoint: string ) {
		const client = yield* ApiClient;
		return yield* client.notifications.unsubscribe( { payload: { endpoint } } );
	} )
);
