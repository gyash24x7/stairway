import * as Context from "effect/Context";

import type * as Effect from "effect/Effect";

import type { UserId } from "@/auth/shared/schema.ts";
import type { PushDevice } from "@/push/shared/schema.ts";

/**
 * Where a user's registered push devices live.
 *
 * Keyed one record per user rather than one key per device. The notify path
 * runs inside a Durable Object while a move is being processed, so a single
 * edge-cached `get` beats a `list({ prefix })` plus a fan-out of reads. The
 * cost is that concurrent registrations from two devices can race and lose one
 * — closed in practice by the client re-registering on every app load, which
 * brings a dropped device back within one page load.
 */
export class PushStore extends Context.Service<PushStore, {
	readonly load: ( userId: UserId ) => Effect.Effect<ReadonlyArray<PushDevice>>;
	readonly upsert: ( userId: UserId, device: PushDevice ) => Effect.Effect<void>;
	readonly remove: (
		userId: UserId,
		endpoints: ReadonlyArray<string>
	) => Effect.Effect<void>;
}>()( "push/Store" ) {}
