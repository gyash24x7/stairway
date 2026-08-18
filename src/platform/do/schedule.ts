import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { withRuntime } from "@/platform/utils/runtime.ts";


/**
 * One pending wake-up: the name it was scheduled under and when it comes due.
 */
export type ScheduledEntry = {
	readonly id: string;
	readonly at: number;
};

/**
 * Many named wake-ups on one Durable Object.
 *
 * An object has exactly one alarm, and arming it replaces whatever was there, so
 * running several timers at once means multiplexing them. This service owns that
 * multiplexing — entries are held in a table keyed by name and the object's alarm
 * tracks the earliest of them — which is why nothing else may touch the alarm.
 * `DurableStorage` deliberately does not expose it.
 *
 * Names are the whole identity: scheduling an id that is already pending moves
 * it rather than adding a second, so a caller with a fixed set of timer names
 * never has to cancel before re-arming.
 */
export class DurableSchedule extends Context.Service<DurableSchedule, {

	/**
	 * Schedules `id` to come due at `at`, moving it if it is already pending.
	 *
	 * @param id - The name to schedule under.
	 * @param at - When it comes due, as an absolute time.
	 */
	readonly set: ( id: string, at: number ) => Effect.Effect<void>;

	/**
	 * Drops a pending wake-up. Does nothing if the name is not scheduled.
	 * @param id - The name to drop.
	 */
	readonly cancel: ( id: string ) => Effect.Effect<void>;

	/** Every pending wake-up, soonest first. */
	readonly list: () => Effect.Effect<ReadonlyArray<ScheduledEntry>>;

	/**
	 * The names now past their time, dropped on the way out so one wake-up cannot
	 * be handled twice. Whatever is still ahead is re-armed, which is what keeps a
	 * wake-up that hands back nothing from stranding the object.
	 */
	readonly due: () => Effect.Effect<ReadonlyArray<string>>;

}>()( "cf/DurableSchedule" ) {}


/**
 * `DurableSchedule` over alchemy's scheduled events, which keep the entries in a
 * SQLite table on the object and reconcile its alarm to the earliest of them
 * after every change.
 *
 * The repeat interval and payload those events carry are deliberately not
 * surfaced: a caller that wants a recurring timer can re-arm on wake, and a name
 * is enough to say which timer fired.
 *
 * @param ctx - The Durable Object this schedule belongs to.
 * @returns The `DurableSchedule` layer for that object.
 */
export const DurableScheduleLive = ( ctx: Cloudflare.DurableObjectState["Service"] ) =>
	Layer.succeed( DurableSchedule, DurableSchedule.of( {
		set: ( id: string, at: number ) => withRuntime(
			Cloudflare.scheduleEvent( id, new Date( at ), null ).pipe(
				Effect.provideService( Cloudflare.DurableObjectState, ctx )
			)
		),

		cancel: ( id: string ) => withRuntime(
			Cloudflare.cancelEvent( id ).pipe(
				Effect.provideService( Cloudflare.DurableObjectState, ctx )
			)
		),

		list: () => withRuntime(
			Cloudflare.listEvents.pipe(
				Effect.provideService( Cloudflare.DurableObjectState, ctx ),
				Effect.map( events => events.map( ( { id, runAt } ) => ( { id, at: runAt.getTime() } ) ) )
			)
		),

		due: () => withRuntime(
			Cloudflare.processScheduledEvents.pipe(
				Effect.provideService( Cloudflare.DurableObjectState, ctx ),
				Effect.map( events => events.map( event => event.id ) )
			)
		)
	} ) );
