import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { generateRequestDetails } from "web-push-neo";

import { PushStore } from "@/push/server/store.ts";

import type { UserId } from "@/auth/shared/schema.ts";
import type { PushMessage } from "@/push/shared/protocol.ts";

/**
 * VAPID identifies this application server to every push service.
 *
 * The keypair is generate-once: rotating it invalidates every subscription
 * already stored, because a subscription is bound to the public key it was
 * created with. The public half is *also* injected into the client bundle as
 * `VITE_VAPID_PUBLIC_KEY` (see `alchemy.run.ts`) — the browser needs it to
 * subscribe, and so does the service worker when an endpoint rotates, which
 * happens in a context with no session and therefore no way to fetch it.
 *
 * Every field is optional so a deployment without keys still runs:
 * `SwishNotifierNoop` takes over and games work with notifications simply off.
 * Use `bun scripts/generate-vapid-keys.mjs` to mint a pair.
 */
export const VapidConfig = Effect.all( {
	subject: Config.string( "VAPID_SUBJECT" ).pipe( Config.option ),
	publicKey: Config.string( "VAPID_PUBLIC_KEY" ).pipe( Config.option ),
	privateKey: Config.redacted( "VAPID_PRIVATE_KEY" ).pipe( Config.option )
} ).pipe( Effect.orDie );

export type PushSendOptions = {
	/** Seconds the push service should hold an undelivered message. */
	readonly ttlSeconds?: number;
	/**
	 * Collapse key. A push service replaces an *undelivered* message carrying the
	 * same topic for the same subscription, which is what stops an undo/redo
	 * storm turning into a stack of notifications on a sleeping phone.
	 */
	readonly topic?: string;
};

export class PushSender extends Context.Service<PushSender, {
	readonly send: (
		userIds: ReadonlyArray<UserId>,
		message: PushMessage,
		options?: PushSendOptions
	) => Effect.Effect<void>;
}>()( "push/Sender" ) {}

/** Push services use these to say "this subscription is gone, stop sending". */
const GONE_STATUSES = [ 404, 410 ];

/**
 * Sends web push notifications.
 *
 * `web-push-neo` is used over the other WebCrypto options for one concrete
 * reason: it encodes payloads as **aes128gcm** (RFC 8291) and signs with the
 * modern `vapid t=…,k=…` scheme. Apple's push service accepts nothing else, and
 * iOS is precisely the platform this feature exists for — libraries still
 * emitting the legacy `aesgcm` draft encoding work on Chrome and fail silently
 * on iPhones. It also separates building the request from performing it, which
 * keeps status-code handling here rather than behind a library's error type.
 */
export const PushSenderLive = Layer.effect(
	PushSender,
	Effect.gen( function* () {
		const store = yield* PushStore;
		const vapid = yield* VapidConfig;

		const details = vapid.subject._tag === "Some"
			&& vapid.publicKey._tag === "Some"
			&& vapid.privateKey._tag === "Some"
			? {
				subject: vapid.subject.value,
				publicKey: vapid.publicKey.value,
				privateKey: Redacted.value( vapid.privateKey.value )
			}
			: undefined;

		/**
		 * Delivers to one device, reporting the endpoint back only when the push
		 * service says it is permanently gone.
		 *
		 * Transient failures (429, 5xx, a dropped connection) are dropped rather
		 * than retried: a "your turn" notice is worthless by the time a retry would
		 * land, and the topic collapse above already covers the next turn.
		 */
		const sendTo = (
			vapidDetails: { subject: string; publicKey: string; privateKey: string },
			device: {
				readonly endpoint: string;
				readonly keys: { readonly p256dh: string; readonly auth: string };
			},
			message: PushMessage,
			options?: PushSendOptions
		) => Effect.gen( function* () {
			const request = yield* Effect.tryPromise( () => generateRequestDetails(
				{ endpoint: device.endpoint, keys: device.keys },
				JSON.stringify( message ),
				{
					TTL: options?.ttlSeconds ?? 900,
					urgency: "high",
					...( options?.topic ? { topic: options.topic } : {} ),
					vapidDetails
				}
			) );

			const response = yield* Effect.tryPromise( () => fetch( request.endpoint, {
				method: request.method,
				headers: request.headers,
				body: request.body
			} ) );

			return GONE_STATUSES.includes( response.status ) ? device.endpoint : undefined;
		} ).pipe(
			// A device that fails for any other reason stays registered — it may
			// simply be a flaky push service, and dropping it would silently stop
			// notifying a real player.
			Effect.catchCause( () => Effect.succeed( undefined ) )
		);

		const sendToUser = (
			vapidDetails: { subject: string; publicKey: string; privateKey: string },
			userId: UserId,
			message: PushMessage,
			options?: PushSendOptions
		) =>
			Effect.gen( function* () {
				const devices = yield* store.load( userId );
				if ( devices.length === 0 ) {
					return;
				}

				const results = yield* Effect.forEach(
					devices,
					device => sendTo( vapidDetails, device, message, options ),
					{ concurrency: 8 }
				);

				yield* store.remove(
					userId,
					results.filter( ( endpoint ): endpoint is string => !!endpoint )
				);
			} );

		return PushSender.of( {
			/**
			 * Never fails. A notification is a courtesy: it must not be able to fail
			 * the game command that triggered it.
			 */
			send: ( userIds, message, options ) => Effect.gen( function* () {
				if ( !details || userIds.length === 0 ) {
					return;
				}

				yield* Effect.forEach(
					userIds,
					userId => sendToUser( details, userId, message, options ),
					{ concurrency: "unbounded", discard: true }
				);
			} ).pipe( Effect.catchCause( () => Effect.void ) )
		} );
	} )
);
