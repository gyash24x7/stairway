import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";


export const StallTimeout = Duration.seconds( 30 );


/**
 * The connection stopped speaking without ever saying so.
 * A subscription that is alive sends a view every heartbeat, so silence past
 * {@link StallTimeout} means the bytes have stopped arriving — and nothing is
 * going to arrive to tell us that. This is the failure that is manufactured in
 * its place, because a stall is otherwise indistinguishable from a game in which
 * nobody has moved yet.
 */
export class SubscriptionStalled extends Data.TaggedError( "SubscriptionStalled" )<{
	readonly after: Duration.Duration;
}> {}

/**
 * The connection ended cleanly, which it is never supposed to do.
 * The endpoint's stream has no last element — it follows the game for as long as
 * anyone is watching. So reaching the end of it means something in the path hung
 * up politely: a proxy recycling a connection, a server shutting down. Turning
 * that into a failure is what lets the retry below treat it like any other
 * broken connection instead of leaving a board frozen on its final frame.
 */
export class SubscriptionEnded extends Data.TaggedError( "SubscriptionEnded" )<{}> {}

/**
 * The failures worth trying again. A dropped connection, a stall, or a stream
 * that quietly ended says nothing about the game, so the subscription is simply
 * reopened.
 *
 * Everything else — an unknown game, a table the caller has no seat at, an
 * expired session — is the server's settled answer, and reconnecting would only
 * ask it again. Anything unrecognised is treated as settled too: showing an
 * error the player can act on beats retrying in silence forever.
 */
const retryableTags = new Set( [ "HttpClientError", "SubscriptionStalled", "SubscriptionEnded" ] );

const isRetryable = ( error: { readonly _tag: string } ) => retryableTags.has( error._tag );

/**
 * Turns the two silent ways a subscription can die into ordinary failures.
 *
 * Neither is something the server sends. A stalled connection produces no
 * bytes at all, and an ended one produces an end-of-stream that `Stream.retry`
 * has no reason to react to — both leave a client that is perfectly healthy,
 * perfectly idle, and permanently out of date. Naming them as errors is what
 * puts them back in reach of the retry.
 */
const withLiveness = <A, E, R>( stream: Stream.Stream<A, E, R> ) => Stream.timeoutOrElse(
	Stream.concat( stream, Stream.fail( new SubscriptionEnded() ) ),
	{
		duration: StallTimeout,
		orElse: () => Stream.fail( new SubscriptionStalled( { after: StallTimeout } ) )
	}
);

/**
 * Keeps a game's subscription open, whatever the network does to it.
 *
 * Reopens a dropped stream quickly at first, then backs off to one attempt every
 * ten seconds, jittered so a server coming back up does not take every open
 * table's reconnect in the same instant.
 *
 * `Stream.retry` re-runs the whole request, and `SubscribeApiEndpoint` opens
 * with the current view, so a reconnect resyncs the board rather than resuming
 * from wherever it was cut off — nothing has to be replayed, buffered or diffed.
 * That is what lets this be a blunt retry rather than a resume protocol. The
 * schedule resets once a view comes through, so the budget below is per outage
 * and not per session.
 *
 * It gives up after two minutes rather than retrying forever, because a
 * subscription that is never coming back should end as an error the player can
 * see and retry, not as a board that has quietly stopped moving. Reaching the
 * end of the schedule fails the stream with whatever last went wrong: the tap
 * re-raises the error it was given, so the original failure reaches the caller
 * rather than some stand-in for it.
 *
 * @param stream - The game's view stream, as the generated client returns it.
 * @returns The same stream, reconnecting on transport failures, stalls and ends.
 */
export const withReconnect = <A, E extends { readonly _tag: string }, R>(
	stream: Stream.Stream<A, E, R>
) => Stream.retry( withLiveness( stream ), Schedule.min( [
	Schedule.exponential( Duration.millis( 500 ) ),
	Schedule.spaced( Duration.seconds( 10 ) )
] ).pipe(
	Schedule.jittered,
	Schedule.upTo( { duration: Duration.minutes( 2 ) } ),
	Schedule.setInputType<E | SubscriptionStalled | SubscriptionEnded>(),
	Schedule.tap( ( { input } ) => isRetryable( input ) ? Effect.void : Effect.fail( input ) )
) );
