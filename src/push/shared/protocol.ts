/**
 * The contract between the push sender and the service worker.
 *
 * Kept free of `effect/Schema` and of every other import on purpose: this module
 * is compiled into `src/sw.ts`, which builds under a *separate* tsconfig with
 * the webworker lib, so anything it drags in has to typecheck in both programs.
 * The wire schemas that validate HTTP payloads live in `schema.ts` instead.
 */

/** Payload of a push notification, as the worker receives it. */
export type PushMessage = {
	/** Why this was sent — currently informational, but it rides along for future filtering. */
	readonly kind: "turn" | "start" | "test";
	/** Game slug, e.g. `"callbreak"`. Doubles as the first path segment of `url`. */
	readonly game: string;
	readonly gameId: string;
	/** The six-character join code, shown in the notification body. */
	readonly code: string;
	readonly title: string;
	readonly body: string;
	/** Absolute path the notification opens. */
	readonly url: string;
};

/** Cache holding the "which games are waiting on me" set that backs the app badge. */
export const BADGE_CACHE = "stairway-badge";

/**
 * Synthetic request key for the badge record. The Cache API only stores
 * `Request`/`Response` pairs, so the state needs a URL-shaped key that will
 * never collide with a real asset.
 */
export const BADGE_KEY = "/__stairway_badge__";

/** `postMessage` type sent by a game screen to clear its own badge entry. */
export const MESSAGE_GAME_OPENED = "game-opened";
