import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { Push } from "@/swish/server/notifier";
import { Notifier } from "@/swish/server/notifier";


/**
 * A `Notifier` that writes down what it was asked to send.
 *
 * The engine forks `notify` rather than waiting on it, so a push lands here a
 * scheduler step after the command that caused it returns. Every command in the
 * harness is itself a message through the cluster, which yields more than once
 * on the way back, so by the time a test reads the log it is there.
 *
 * @returns The layer, and every push handed to it so far, in order.
 */
export const makeTestNotifier = () => {
	const sent: Array<Push> = [];

	const layer = Layer.succeed( Notifier, Notifier.of( {
		notify: pushes => Effect.sync( () => {
			sent.push( ...pushes );
		} )
	} ) );

	return { layer, sent: () => [ ...sent ] as ReadonlyArray<Push> } as const;
};
