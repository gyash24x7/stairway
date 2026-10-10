import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import type * as Scope from "effect/Scope";

import type { User } from "@/auth/schema";
import { isStep, isWalkable, roomAt, WORLD } from "@/world/map";
import type { ClientEvent, Meeple, ServerEvent } from "@/world/schema";
import { JoinedEvent, LeftEvent, MovedEvent, SaidEvent, StatusChangedEvent } from "@/world/schema";


/**
 * The pace limit on steps: on average, one step per `MIN_STEP_INTERVAL`
 * milliseconds per connection, with up to `STEP_BURST` steps allowed back to
 * back.
 *
 * The client steps every 120ms while a key is held, so it never reaches the
 * average rate. The burst allowance is for the network, not the client. Steps
 * sent 120ms apart can arrive together, and a strict minimum gap would drop the
 * second of them. The client's next step would then be two tiles from where
 * the server had it, would be refused, and would snap the avatar back
 * mid-walk. A token bucket accepts that bunching but still stops a client from
 * crossing the map faster than walking would.
 */
export const MIN_STEP_INTERVAL = 80;
export const STEP_BURST = 3;

export type Connection = {
	readonly self: Meeple;
	readonly others: ReadonlyArray<Meeple>;
	/** Every event published after this connection joined, its own `Joined` included. */
	readonly events: PubSub.Subscription<ServerEvent>;
};

/** `steps` is the bucket: how many steps may be taken right now, as of `refilledAt`. */
type Entry = { readonly avatar: Meeple; readonly steps: number; readonly refilledAt: number };

/**
 * Who is in the world, and where they stand.
 *
 * Presence is kept in memory and nowhere else. It does not survive a restart,
 * and nothing should depend on it surviving one: a restart drops every socket,
 * each client reconnects, and the world fills up again. That is why this is a
 * plain service and not a swish entity. Nothing is replayed, archived or
 * redacted, and the whole state is one map.
 *
 * It lives on one process, the same way `SingleRunner` keeps every game entity
 * on one process. Running more than one server would need the map and the
 * PubSub moved to Redis.
 *
 * The server is the authority on position. A client predicts its own steps so
 * that walking feels instant, but a step counts only once `move` accepts it.
 * The room an avatar is in is always derived from its position here. A client
 * never says which room it is in, so the room panel cannot be opened for a
 * room the avatar has not walked into.
 */
export class WorldPresence extends Context.Service<WorldPresence, {
	/**
	 * Places `user` at the spawn point. The returned subscription closes with
	 * the caller's scope.
	 *
	 * The subscription is opened before the avatar is added or anything is
	 * published, so no event can land between reading the snapshot and starting
	 * to listen.
	 */
	readonly join: ( user: User ) => Effect.Effect<Connection, never, Scope.Scope>;
	readonly leave: ( connId: string ) => Effect.Effect<void>;
	readonly handle: ( connId: string, message: ClientEvent ) => Effect.Effect<void>;
	readonly avatars: Effect.Effect<ReadonlyArray<Meeple>>;
}>()( "world/WorldPresence" ) {}

export const WorldPresenceLive = Layer.effect(
	WorldPresence,
	Effect.gen( function* () {
		const entries = yield* Ref.make( HashMap.empty<string, Entry>() );
		const counter = yield* Ref.make( 0 );
		// Sliding: a client that stops reading loses its oldest events and is
		// never allowed to hold up anyone else's. The next `Moved` for each avatar
		// corrects whatever it missed.
		const pubsub = yield* PubSub.sliding<ServerEvent>( 1024 );
		yield* Effect.addFinalizer( () => PubSub.shutdown( pubsub ) );

		const publish = ( event: ServerEvent ) => PubSub.publish( pubsub, event ).pipe( Effect.asVoid );

		const join = Effect.fnUntraced( function* ( user: User ) {
			const events = yield* PubSub.subscribe( pubsub );
			const connId = `c${ yield* Ref.updateAndGet( counter, n => n + 1 ) }`;
			const self: Meeple = {
				connId,
				userId: user.id,
				name: user.name,
				avatar: user.avatar,
				pos: WORLD.spawn,
				facing: "down",
				room: null,
				status: "idle"
			};

			const before = yield* Ref.getAndUpdate(
				entries,
				HashMap.set( connId, { avatar: self, steps: STEP_BURST, refilledAt: 0 } )
			);

			yield* publish( JoinedEvent.make( { avatar: self } ) );

			return {
				self,
				others: Array.from( HashMap.values( before ), entry => entry.avatar ),
				events
			} satisfies Connection;
		} );

		const leave = Effect.fnUntraced( function* ( connId: string ) {
			const before = yield* Ref.getAndUpdate( entries, HashMap.remove( connId ) );
			if ( HashMap.has( before, connId ) ) {
				yield* publish( LeftEvent.make( { connId } ) );
			}
		} );

		/**
		 * Accepts a step if it is one tile, onto walkable ground, and within the
		 * pace limit. Every request gets a `Moved` back, even a
		 * refused one: a refusal publishes the position the server kept, which is
		 * how a client that predicted wrong is moved back.
		 *
		 * A step over the pace limit is the exception and is dropped with no reply.
		 * Answering a client that is sending too fast would only send it more
		 * traffic, and the next step it sends in time puts it right.
		 */
		const move = Effect.fnUntraced( function* (
			connId: string,
			message: Extract<ClientEvent, { _tag: "world/evt/Move" }>
		) {
			const now = yield* Clock.currentTimeMillis;
			const outcome = yield* Ref.modify( entries, map => {
				const entry = Option.getOrUndefined( HashMap.get( map, connId ) );
				if ( !entry ) {
					return [ undefined, map ] as const;
				}

				const steps = Math.min(
					STEP_BURST,
					entry.steps + ( now - entry.refilledAt ) / MIN_STEP_INTERVAL
				);

				if ( steps < 1 ) {
					return [ undefined, map ] as const;
				}

				const legal = isStep( entry.avatar.pos, message.pos ) && isWalkable( message.pos );
				const pos = legal ? message.pos : entry.avatar.pos;
				const avatar: Meeple = {
					...entry.avatar,
					pos,
					facing: message.facing,
					room: roomAt( pos )?.game ?? null
				};

				return [
					avatar,
					HashMap.set( map, connId, { avatar, steps: steps - 1, refilledAt: now } )
				] as const;
			} );

			if ( outcome ) {
				const { pos, facing, room } = outcome;
				yield* publish( MovedEvent.make( { connId, pos, facing, room } ) );
			}
		} );

		const update = ( connId: string, f: ( avatar: Meeple ) => Meeple ) =>
			Ref.modify( entries, map => {
				const entry = Option.getOrUndefined( HashMap.get( map, connId ) );
				return entry
					? [ true, HashMap.set( map, connId, { ...entry, avatar: f( entry.avatar ) } ) ] as const
					: [ false, map ] as const;
			} );

		const handle = Effect.fnUntraced( function* ( connId: string, message: ClientEvent ) {
			switch ( message._tag ) {
				case "world/evt/Move":
					return yield* move( connId, message );

				case "world/evt/SetStatus": {
					const known = yield* update(
						connId,
						avatar => ( { ...avatar, status: message.status } )
					);
					if ( known ) {
						yield* publish( StatusChangedEvent.make( { connId, status: message.status } ) );
					}
					return;
				}

				case "world/evt/Say": {
					const text = message.text.trim();
					const known = yield* Ref.get( entries ).pipe( Effect.map( HashMap.has( connId ) ) );
					if ( known && text !== "" ) {
						yield* publish( SaidEvent.make( { connId, text } ) );
					}

					return;
				}

				case "world/evt/Pong":
					// Liveness only. The socket reads it as proof the client is
					// running, and there is nothing to change in the world.
					return;
			}
		} );

		const avatars = Ref.get( entries ).pipe(
			Effect.map( map => Array.from( HashMap.values( map ), entry => entry.avatar ) )
		);

		return WorldPresence.of( { join, leave, handle, avatars } );
	} )
);
