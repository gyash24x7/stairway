import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { RpConfig } from "@/auth/server/webauthn.ts";
import { PushSender } from "@/push/server/sender.ts";
import { SwishNotifier } from "@/swish/server/notify.ts";

import type { Notice } from "@/swish/server/notify.ts";
import type { GameHeader } from "@/swish/shared/schema.ts";

/**
 * Turns a decided notice into an actual push.
 *
 * The wording is intentionally thin. A notification is read on a lock screen in
 * about a second, and everything that matters — which game, which table — fits
 * in a title and one line. Anything richer belongs behind the tap.
 *
 * @param game - The game slug, e.g. `"callbreak"`.
 * @param origin - The site origin notifications should open against.
 */
const buildMessage = ( game: string, origin: string ) =>
	( notice: Notice, header: GameHeader ) => {
		const title = notice.kind === "start"
			? `${ game.toUpperCase() } — game on`
			: `${ game.toUpperCase() } — your turn`;

		const body = notice.kind === "start"
			? `Table ${ header.code } has started.`
			: `Table ${ header.code } is waiting on you.`;

		return {
			kind: notice.kind,
			game,
			gameId: header.id,
			code: header.code,
			title,
			body,
			// Every game exposes `/{game}/{gameId}`, so this needs no per-game table.
			url: `${ origin }/${ game }/${ header.id }`
		} as const;
	};

/**
 * Production notifier: fans a notice out to the recipients' registered devices.
 *
 * @param game - The game slug this Durable Object hosts.
 */
export const SwishNotifierLive = ( game: string ) => Layer.effect(
	SwishNotifier,
	Effect.gen( function* () {
		const sender = yield* PushSender;
		// The site origin doubles as the WebAuthn relying-party origin — there is
		// only one front end, and a notification has to open on it.
		const { rpOrigin } = yield* RpConfig;
		const message = buildMessage( game, rpOrigin );

		return SwishNotifier.of( {
			announce: ( notice, header ) => sender.send(
				notice.recipients,
				message( notice, header ),
				{
					// Collapse an undelivered notice for the same table rather than
					// stacking: an undo/redo storm should be one buzz, not six.
					topic: header.id,
					ttlSeconds: 900
				}
			)
		} );
	} )
);

/**
 * The binding used when no VAPID keys are configured — local development, CI,
 * or a deployment that simply does not want notifications.
 *
 * A missing notification key must never be able to fail a game command, so the
 * absence is modelled as a working notifier that does nothing rather than as an
 * error at layer construction.
 */
export const SwishNotifierNoop = Layer.succeed(
	SwishNotifier,
	SwishNotifier.of( { announce: () => Effect.void } )
);
