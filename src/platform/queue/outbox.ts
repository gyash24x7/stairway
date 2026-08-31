import * as Cloudflare from "alchemy/Cloudflare";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { withRuntime } from "@/platform/utils/runtime.ts";
import { SwishOutbox } from "@/swish/server/services.ts";
import { toLedgerEntries } from "@/swish/server/utils.ts";
import { GameCompletion } from "@/swish/shared/schema.ts";


/**
 * The one queue every finished game leaves by, whatever game it was.
 *
 * There is a single queue rather than one per game because nothing about
 * closing a game out is game-specific: the consumer files an opaque archive and
 * writes ranks and scores, and a queue per game would multiply that same
 * consumer by seven for no gain.
 */
export const OutboxQueue = Cloudflare.Queues.Queue( "OutboxQueue" );

/**
 * The engine's exit for a completed game, over the outbox queue.
 *
 * This runs inside the Durable Object that just finished the game, and it is
 * deliberately the *only* thing that happens there: the alternative — writing
 * KV and D1 inline — makes closing a game out as slow and as failure-prone as
 * the slowest store it touches, on the very command a table is waiting on. A
 * send is one hop, and everything past it is the consumer's problem to retry.
 *
 * Both facts the stores need are settled here rather than downstream. The clock
 * reading is the moment the game ended, not the moment a consumer got to it,
 * and the standings are flattened while they are still typed — which also means
 * a redelivered message writes exactly what its first delivery would have,
 * rather than a second answer to the same question.
 *
 * A send that fails dies. The game itself is safe either way: the commit that
 * completed it has already landed in the log, so what a failed send costs is
 * the table's record of the game, not the game.
 *
 * This is an effect rather than a `Layer` because of where it has to be built.
 * The WebSocket base pins its domain to the Durable Object's *own* services, so
 * a layer reaching for a Cloudflare binding cannot be provided alongside the
 * other host services — the producer is resolved a level out, where the object's
 * bindings are in scope, and handed to the engine as a value.
 */
export const SwishOutboxLive = ( queue: Cloudflare.Queues.WriteQueueClient ) =>
	Layer.succeed( SwishOutbox, SwishOutbox.of( {
		publishArchive: ( address, data ) => Effect.gen( function* () {
			const completion = GameCompletion.make( {
				address,
				completedAt: yield* Clock.currentTimeMillis,
				entries: toLedgerEntries( data.results ),
				archive: data
			} );

			yield* withRuntime( queue.send( completion ).pipe( Effect.orDie ) );
		} )
	} ) );
