import * as Schema from "effect/Schema";


/**
 * What the app needs before it can ask the browser for a subscription.
 * - publicKey: The VAPID public key, base64url, which the browser binds the
 * 		subscription to. `null` when the server has no keys configured, which is
 * 		how a client knows not to offer notifications at all.
 */
export type PushKey = typeof PushKey.Type;
export const PushKey = Schema.Struct( {
	publicKey: Schema.NullOr( Schema.NonEmptyString )
} );

/**
 * A browser's push subscription, exactly as `PushSubscription.toJSON()` writes
 * it, so the client sends it on without reshaping and the service worker can do
 * the same when the push service rotates it.
 * - endpoint: The push service URL this device is reached at; unique per device
 * - keys: The device's key pair for encrypting what is sent to it
 */
export type SubscriptionInput = typeof SubscriptionInput.Type;
export const SubscriptionInput = Schema.Struct( {
	endpoint: Schema.NonEmptyString,
	expirationTime: Schema.optional( Schema.NullOr( Schema.Number ) ),
	keys: Schema.Struct( {
		p256dh: Schema.NonEmptyString,
		auth: Schema.NonEmptyString
	} )
} );

/** Which device to stop sending to. */
export type UnsubscribeInput = typeof UnsubscribeInput.Type;
export const UnsubscribeInput = Schema.Struct( {
	endpoint: Schema.NonEmptyString
} );
