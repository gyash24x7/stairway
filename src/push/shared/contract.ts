import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import { PushStatus, UnsubscribeInput, WebPushSubscription } from "@/push/shared/schema.ts";


// --- Push Api Group -------------------------------------------------------

const SubscribeEndpoint = HttpApiEndpoint.post( "subscribe", "/subscribe", {
	payload: WebPushSubscription,
	success: PushStatus
} );

const UnsubscribeEndpoint = HttpApiEndpoint.post( "unsubscribe", "/unsubscribe", {
	payload: UnsubscribeInput,
	success: PushStatus
} );

/**
 * Sends a notification to the caller's own devices.
 *
 * Earns its place twice over: it is the end-to-end check that VAPID signing,
 * payload encryption and the service worker registration all actually work, and
 * it doubles as the "you're all set" confirmation right after a user grants
 * permission.
 */
const TestEndpoint = HttpApiEndpoint.post( "test", "/test", {
	success: Schema.Void
} );

/**
 * Every endpoint is POST, including unsubscribe, which reads as un-RESTful.
 *
 * That is deliberate: the worker's CORS allows only GET, POST and OPTIONS with
 * a fixed header allowlist, and widening it would be a change to the same
 * cross-origin path the passkey session cookie rides on. Modelling unsubscribe
 * as a POST with a body keeps that configuration untouched.
 */
export const PushApiGroup = HttpApiGroup.make( "push" )
	.add( SubscribeEndpoint )
	.add( UnsubscribeEndpoint )
	.add( TestEndpoint )
	.prefix( "/push" )
	.middleware( AuthMiddleware );
