import type { ChatBody, ChatPolicy } from "@/chat/shared/schema.ts";

/**
 * The chat subsystem's pure decisions, kept free of any Cloudflare import so
 * they can be exercised directly. `api.ts` is the wiring; this is the logic.
 */

// --- Storage layout ----------------------------------------------------------

export const KEY_SEQ = "seq";
export const KEY_MSG_PREFIX = "msg:";

/**
 * One storage key per message rather than a single array: a DO storage *value*
 * is capped at 128KB, which a long-running channel would blow through, and
 * `list({ prefix })` hands the keys back in lexicographic order. The zero
 * padding is what makes that order chronological — without it `msg:10` sorts
 * before `msg:9`.
 */
export const messageKey = ( seq: number ) =>
	`${ KEY_MSG_PREFIX }${ String( seq ).padStart( 12, "0" ) }`;

// --- Policy ------------------------------------------------------------------

/**
 * Whether the channel's policy permits this body.
 *
 * This is *the* security decision for a restricted channel — the client hiding
 * its text input is a courtesy, this is what actually holds.
 */
export const isBodyAllowed = ( policy: ChatPolicy, body: ChatBody ) =>
	body._tag === "chat/Text" ? policy.text : policy.reactions;

// --- Rate limit --------------------------------------------------------------

export const RATE_LIMIT_MESSAGES = 5;
export const RATE_LIMIT_WINDOW_MS = 5_000;

/**
 * Sliding-window admission for one author. Returns the pruned timestamp list so
 * the caller can store it back — admitted posts append `now`, rejected ones
 * don't, so spamming into a full window never extends the ban.
 */
export const admitMessage = ( recent: ReadonlyArray<number>, now: number ) => {
	const kept = recent.filter( at => now - at < RATE_LIMIT_WINDOW_MS );

	return kept.length >= RATE_LIMIT_MESSAGES
		? ( { allowed: false, recent: kept } as const )
		: ( { allowed: true, recent: [ ...kept, now ] } as const );
};
