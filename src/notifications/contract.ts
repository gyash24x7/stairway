import * as Schema from "effect/Schema";

import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import { PushKey, SubscriptionInput, UnsubscribeInput } from "@/notifications/schema";


/** `GET /api/notifications/key` — the VAPID public key a subscription is bound to. */
const KeyEndpoint = HttpApiEndpoint.get( "key", "/key", {
	success: PushKey
} );

/**
 * `PUT /api/notifications/subscription` — this device should be told about the
 * caller's games.
 *
 * An upsert on the endpoint, not an insert. A device is one endpoint whoever is
 * signed in on it, so a second account subscribing from the same browser takes
 * the device over rather than both of them being sent each other's turns.
 */
const SubscribeEndpoint = HttpApiEndpoint.put( "subscribe", "/subscription", {
	payload: SubscriptionInput,
	success: Schema.Void
} );

/**
 * `POST /api/notifications/subscription/remove` — stop telling this device.
 *
 * Sent before logout as well as from the toggle, so a shared device stops
 * hearing about the previous player's games. Only the caller's own rows are
 * removed: an endpoint is not a secret worth trusting on its own.
 */
const UnsubscribeEndpoint = HttpApiEndpoint.post( "unsubscribe", "/subscription/remove", {
	payload: UnsubscribeInput,
	success: Schema.Void
} );

const NotificationsApiGroup = HttpApiGroup.make( "notifications" )
	.add( KeyEndpoint )
	.add( SubscribeEndpoint )
	.add( UnsubscribeEndpoint )
	.middleware( AuthMiddleware )
	.prefix( "/notifications" );

export const NotificationsApi = HttpApi.make( "api" ).add( NotificationsApiGroup ).prefix( "/api" );
