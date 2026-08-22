import * as Schema from "effect/Schema";

/**
 * Wire types for push subscription management.
 *
 * Named `WebPushSubscription` rather than `PushSubscription` on purpose: the
 * latter is a DOM global, and shadowing it in files that also touch the browser
 * API is a trap for whoever reads this next.
 */

export const WebPushKeys = Schema.Struct( {
	/** The subscription's public key, base64url. */
	p256dh: Schema.NonEmptyString,
	/** The shared auth secret, base64url. */
	auth: Schema.NonEmptyString
} );

/**
 * Exactly the shape `PushSubscription.toJSON()` produces, so the client can
 * hand it over untouched. Endpoints are bounded because they are used as map
 * keys and stored verbatim.
 */
export const WebPushSubscription = Schema.Struct( {
	endpoint: Schema.NonEmptyString.check( Schema.isMaxLength( 2048 ) ),
	expirationTime: Schema.optional( Schema.NullOr( Schema.Number ) ),
	keys: WebPushKeys
} );

export type WebPushSubscription = typeof WebPushSubscription.Type;

export const UnsubscribeInput = Schema.Struct( {
	endpoint: Schema.NonEmptyString.check( Schema.isMaxLength( 2048 ) )
} );

export type UnsubscribeInput = typeof UnsubscribeInput.Type;

/**
 * Returned by every mutation so the client can say "3 devices" without a
 * second round trip.
 */
export const PushStatus = Schema.Struct( {
	deviceCount: Schema.Number
} );

export type PushStatus = typeof PushStatus.Type;

/** A registered device, as stored. */
export type PushDevice = {
	readonly endpoint: string;
	readonly keys: { readonly p256dh: string; readonly auth: string };
	readonly createdAt: number;
	readonly lastSeenAt: number;
};
