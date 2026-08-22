import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { PushSender } from "@/push/server/sender.ts";
import { PushStore } from "@/push/server/store.ts";

// --- Push Http Api Implementation -------------------------------------------------

export const PushApiLive = HttpApiBuilder.group( StairwayAPI, "push", handlers =>
	Effect.gen( function* () {
		const store = yield* PushStore;
		const sender = yield* PushSender;

		return handlers
			/**
			 * Idempotent by endpoint: the client re-posts its current subscription on
			 * every load, which refreshes the record's TTL and repairs any device
			 * lost to a concurrent write.
			 */
			.handle( "subscribe", ( { payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const now = yield* Clock.currentTimeMillis;

				yield* store.upsert( user.id, {
					endpoint: payload.endpoint,
					keys: payload.keys,
					createdAt: now,
					lastSeenAt: now
				} );

				const devices = yield* store.load( user.id );
				return { deviceCount: devices.length };
			} ) )

			.handle( "unsubscribe", ( { payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				yield* store.remove( user.id, [ payload.endpoint ] );

				const devices = yield* store.load( user.id );
				return { deviceCount: devices.length };
			} ) )

			.handle( "test", () => Effect.gen( function* () {
				const { user } = yield* AuthContext;

				yield* sender.send( [ user.id ], {
					kind: "test",
					game: "stairway",
					gameId: "test",
					code: "",
					title: "Stairway",
					body: "Notifications are on. You'll hear from us when it's your turn.",
					url: "/"
				}, {
					// A distinct topic so a test never collapses a live turn notice.
					topic: "test"
				} );
			} ) );
	} ) );
