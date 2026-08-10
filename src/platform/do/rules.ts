import { type Audience, PlayerAudience, PlayerId, TableAudience } from "@/shared/swish/schema.ts";

/**
 * The pure decisions behind `GameChannel`. Extracted so they can be tested without
 * `alchemy/Cloudflare` — the DO itself has no test harness, and socket admission is
 * the one place in the sync surface where a mistake leaks another player's hand.
 */

/** The per-audience payload the engine hands `broadcast` (already JSON-plain). */
export interface BroadcastSnapshot {
	readonly table: unknown;
	readonly playerViews: Record<string, unknown>;
}

/** The verdict on a `/sync/` upgrade: reject with a status, or admit with an audience. */
export type SocketAdmission =
	| { readonly _tag: "reject"; readonly status: 401 | 403 }
	| { readonly _tag: "admit"; readonly audience: Audience };

/**
 * Decides whether a `/sync/` upgrade is allowed, and which audience it attaches.
 *
 * - no session            → 401. A couch screen is still a *logged-in* screen. An
 *                           absent `?playerId=` used to mean "unauthenticated table
 *                           stream", which was the one hole in the sync surface.
 * - `playerId` ≠ session  → 403. Nobody attaches to another player's private stream.
 * - `playerId` = session  → the player audience (a phone / controller).
 * - no `playerId`         → the table audience (the TV / couch).
 *
 * @param playerId - The `?playerId=` query param, or `null` for the table stream.
 * @param sessionUserId - The id on the request's session, or `null` when unauthenticated.
 * @returns The admission verdict.
 */
export const admitSocket = ( playerId: string | null, sessionUserId: string | null ) => {
	if ( !sessionUserId ) {
		return { _tag: "reject", status: 401 } satisfies SocketAdmission;
	}

	if ( !!playerId && playerId !== sessionUserId ) {
		return { _tag: "reject", status: 403 } satisfies SocketAdmission;
	}

	return {
		_tag: "admit",
		audience: playerId
			? PlayerAudience.make( { id: PlayerId.make( playerId ) } )
			: TableAudience.make( {} )
	} satisfies SocketAdmission;
};

/**
 * Picks the body a socket with `audience` receives from one broadcast. A player
 * with no projection of their own falls back to the table view — a seat that has
 * left mid-broadcast still sees a coherent board rather than nothing.
 *
 * @param audience - The audience attached to the socket.
 * @param snapshot - The per-audience payload from the engine.
 * @returns The payload to send on this socket.
 */
export const frameFor = ( audience: Audience, snapshot: BroadcastSnapshot ) =>
	audience._tag === "swish/Player"
		? snapshot.playerViews[ audience.id ] ?? snapshot.table
		: snapshot.table;
