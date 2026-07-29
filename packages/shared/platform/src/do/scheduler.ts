import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** The kinds of deferred wake-up the engine schedules. */
export type AlarmKind = "auto-start" | "bot" | "interaction-timeout" | "move-timeout";

/**
 * Deferred work: multiple named timers, each firing an `AlarmKind`. The host
 * keeps a `key -> alarm` map and arms its single wake-up at the earliest pending
 * time; on wake it returns (and clears) the timers now due and re-arms for the
 * next. This lets a bot delay, a reaction deadline, and a move clock all run
 * concurrently. `cancel(key)` drops one timer; `cancelAll` drops them all.
 */
export class Scheduler extends Context.Service<Scheduler, {
	readonly schedule: ( key: string, delayMillis: number, alarm: AlarmKind ) =>
		Effect.Effect<void, never, Alchemy.RuntimeContext>;

	readonly cancel: ( key: string ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;

	readonly cancelAll: () => Effect.Effect<void, never, Alchemy.RuntimeContext>;

	readonly due: () => Effect.Effect<ReadonlyArray<AlarmKind>, never, Alchemy.RuntimeContext>;
}>()( "stairway/Scheduler" ) {}

/**
 * Backs {@link Scheduler} with Alchemy's SQLite-backed scheduled-events API
 * (`Cloudflare.Workers.scheduleEvent` / `cancelEvent` / `processScheduledEvents`),
 * which owns the Durable Object's single alarm: each named event carries its
 * `AlarmKind` as the payload, and Alchemy re-arms (or clears) the DO alarm at the
 * earliest pending event on every mutation. `due()` fires whatever is now ready.
 */
export const DurableSchedulerLive = ( ctx: Cloudflare.DurableObjectState[ "Service" ] ) => {
	// The scheduled-events helpers resolve `DurableObjectState` from context;
	// supply the one we hold so callers only need `RuntimeContext`.
	const withState = <A, E, R>( effect: Effect.Effect<A, E, R> ) =>
		effect.pipe( Effect.provideService( Cloudflare.DurableObjectState, ctx ) );

	return Layer.succeed( Scheduler, Scheduler.of( {
		schedule: ( key, delayMillis, alarm ) => withState(
			Cloudflare.Workers.scheduleEvent( key, new Date( Date.now() + delayMillis ), alarm )
		),

		cancel: ( key ) => withState( Cloudflare.Workers.cancelEvent( key ) ),

		cancelAll: () => withState( Effect.gen( function* () {
			const events = yield* Cloudflare.Workers.listEvents;
			yield* Effect.forEach( events, ( event ) => Cloudflare.Workers.cancelEvent( event.id ) );
		} ) ),

		due: () => withState( Effect.gen( function* () {
			const fired = yield* Cloudflare.Workers.processScheduledEvents;
			return fired.map( ( event ) => event.payload as AlarmKind );
		} ) )
	} ) );
};