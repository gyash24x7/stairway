import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";

import type { UserId } from "@/auth/schema";
import type { SubscriptionInput } from "@/notifications/schema";
import type { PushSubscriptionRow } from "@/notifications/server/tables";
import { pushSubscriptions } from "@/notifications/server/tables";
import { Database } from "@/shared/utils/database";
import type { Push } from "@/swish/server/notifier";
import { Notifier } from "@/swish/server/notifier";


// --- Keys ------------------------------------------------------------------

/**
 * The server's VAPID identity: what a push service checks every send against,
 * and what a browser binds a subscription to when it is created.
 *
 * Optional, so a development server with no keys in its `.env` still boots: it
 * answers `publicKey: null`, the client then offers no notifications, and the
 * engine's notices go nowhere. Generate a pair with
 * `bunx web-push generate-vapid-keys`. Changing the pair orphans every existing
 * subscription — the browser holds the old public key — so it is set once.
 */
export type VapidKeys = {
	readonly publicKey: string;
	readonly privateKey: Redacted.Redacted;
	readonly subject: string;
};

export class Vapid extends Context.Service<Vapid, Option.Option<VapidKeys>>()( "notifications/Vapid" ) {}

export const VapidLive = Layer.effect( Vapid, Effect.gen( function* () {
	const keys = yield* Config.option( Config.all( {
		publicKey: Config.String( "VAPID_PUBLIC_KEY" ),
		privateKey: Config.Redacted( "VAPID_PRIVATE_KEY" ),
		subject: Config.String( "VAPID_SUBJECT" )
	} ) ).pipe( Effect.orDie );

	if ( Option.isNone( keys ) ) {
		yield* Effect.logWarning( "notifications: no VAPID keys configured, push is disabled" );
	}

	return keys;
} ) );


// --- Subscriptions -----------------------------------------------------------

/**
 * The four queries push makes. Like `AuthRepository`, every one dies rather
 * than failing: nothing that calls them can do better with an unreachable
 * database than the defect handler does.
 */
export class PushRepository extends Context.Service<PushRepository, {
	readonly save: ( userId: UserId, input: SubscriptionInput, userAgent: string | undefined ) => Effect.Effect<void>;
	readonly remove: ( userId: UserId, endpoint: string ) => Effect.Effect<void>;
	readonly forUsers: ( userIds: ReadonlyArray<UserId> ) => Effect.Effect<ReadonlyArray<PushSubscriptionRow>>;
	readonly forget: ( endpoint: string ) => Effect.Effect<void>;
	readonly touch: ( endpoint: string ) => Effect.Effect<void>;
}>()( "notifications/PushRepository" ) {}

export const PushRepositoryLive = Layer.effect( PushRepository, Effect.gen( function* () {
	const db = yield* Database;

	return PushRepository.of( {
		save: Effect.fn( function* ( userId, input, userAgent ) {
			const row = {
				userId,
				endpoint: input.endpoint,
				p256dh: input.keys.p256dh,
				auth: input.keys.auth,
				userAgent
			};
			yield* db.insert( pushSubscriptions )
				.values( row )
				.onConflictDoUpdate( {
					target: pushSubscriptions.endpoint,
					set: { userId, p256dh: row.p256dh, auth: row.auth, userAgent }
				} )
				.pipe( Effect.orDie );
		} ),

		remove: Effect.fn( function* ( userId, endpoint ) {
			yield* db.delete( pushSubscriptions )
				.where( and( eq( pushSubscriptions.userId, userId ), eq( pushSubscriptions.endpoint, endpoint ) ) )
				.pipe( Effect.orDie );
		} ),

		forUsers: Effect.fn( function* ( userIds ) {
			if ( userIds.length === 0 ) {
				return [];
			}
			return yield* db.select().from( pushSubscriptions )
				.where( inArray( pushSubscriptions.userId, [ ...userIds ] ) )
				.pipe( Effect.orDie );
		} ),

		forget: Effect.fn( function* ( endpoint ) {
			yield* db.delete( pushSubscriptions )
				.where( eq( pushSubscriptions.endpoint, endpoint ) )
				.pipe( Effect.orDie );
		} ),

		touch: Effect.fn( function* ( endpoint ) {
			yield* db.update( pushSubscriptions )
				.set( { lastSuccessAt: new Date() } )
				.where( eq( pushSubscriptions.endpoint, endpoint ) )
				.pipe( Effect.orDie );
		} )
	} );
} ) );


// --- Sending -----------------------------------------------------------------

/**
 * How long a push service should hold a notice for a device that is offline.
 * Past this a turn has likely been timed out to the bot policy anyway, and a
 * notice arriving the next morning about it is noise.
 */
const TIME_TO_LIVE_SECONDS = 60 * 60 * 6;

/** The push service answered that this subscription no longer exists. */
const isGone = ( error: unknown ) =>
	error instanceof webpush.WebPushError && ( error.statusCode === 404 || error.statusCode === 410 );

/**
 * The engine's `Notifier`, delivered as Web Push.
 *
 * Each push goes to every device its player has subscribed. A device the push
 * service says is gone (404, 410) is forgotten on the spot — that is the only
 * way a subscription ever learns it was revoked in the browser's settings. Any
 * other failure is logged and dropped: a notice is a convenience, and retrying
 * one risks it arriving after the turn it was about.
 *
 * Being asked whose turn it is is "high" urgency, which is what lets a phone in
 * battery saver wake for it; everything else can wait for the device's next
 * natural wake-up.
 */
export const PushNotifierLive = Layer.effect( Notifier, Effect.gen( function* () {
	const vapid = yield* Vapid;
	const repository = yield* PushRepository;

	if ( Option.isNone( vapid ) ) {
		return Notifier.of( { notify: () => Effect.void } );
	}

	const vapidDetails = {
		subject: vapid.value.subject,
		publicKey: vapid.value.publicKey,
		privateKey: Redacted.value( vapid.value.privateKey )
	};

	const send = ( push: Push, row: PushSubscriptionRow ) => Effect.tryPromise( () => webpush.sendNotification(
		{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
		JSON.stringify( push.notice ),
		{
			vapidDetails,
			TTL: TIME_TO_LIVE_SECONDS,
			urgency: push.kind === "turn" || push.kind === "respond" ? "high" : "normal"
		}
	) ).pipe(
		Effect.andThen( repository.touch( row.endpoint ) ),
		Effect.catch( ( { cause } ) => isGone( cause )
			? repository.forget( row.endpoint )
			: Effect.logWarning( "notifications: push failed", cause )
		)
	);

	return Notifier.of( {
		notify: pushes => Effect.gen( function* () {
			const rows = yield* repository.forUsers( pushes.map( push => push.playerId as string as UserId ) );
			yield* Effect.forEach(
				pushes.flatMap( push => rows.filter( row => row.userId === push.playerId ).map( row => [ push, row ] as const ) ),
				( [ push, row ] ) => send( push, row ),
				{ concurrency: 8, discard: true }
			);
		} ).pipe(
			Effect.catchCause( cause => Effect.logError( "notifications: could not send", cause ) )
		)
	} );
} ) );
