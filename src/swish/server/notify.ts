import * as Context from "effect/Context";

import type * as Effect from "effect/Effect";

import { UserId } from "@/auth/shared/schema.ts";
import { PlayerId } from "@/swish/shared/schema.ts";
import { pendingActor } from "@/swish/shared/turn.ts";

import type { GameHeader, GameStatus } from "@/swish/shared/schema.ts";

/**
 * Deciding when a game should tap someone on the shoulder.
 *
 * The engine broadcasts to *connected sockets*, which is exactly the set of
 * people who do not need telling. Everyone the game is waiting on who is not in
 * that set has no way to learn it is their turn short of reopening the app —
 * that gap is what this closes.
 *
 * The decision is pure and lives here rather than in the platform layer so it
 * can be tested without a Durable Object, a network, or a real push service.
 *
 * A seat's `PlayerId` is the seated user's id: the sync layer already goes the
 * other way with `PlayerId.make( userId )`.
 */

/**
 * What the previous publish told us, so the next one can tell an actual
 * handover from a republish of the same turn.
 *
 * Persisted in Durable Object storage rather than held in a closure: a
 * hibernating WebSocket DO re-runs its constructor on wake, and the first
 * publish after waking is not guaranteed to change the actor (an interaction
 * response, an undo). One extra key buys certainty.
 */
export type NoticeState = {
	readonly status: GameStatus;
	readonly actor?: PlayerId;
};

export type Notice =
	| { readonly kind: "start"; readonly recipients: ReadonlyArray<UserId> }
	| { readonly kind: "turn"; readonly recipients: ReadonlyArray<UserId> };

export type NoticeDecision = {
	readonly notice?: Notice;
	readonly state: NoticeState;
};

/**
 * Decides what — if anything — to send for a freshly published view.
 *
 * Note there is deliberately no "don't notify the player who just moved" rule:
 * it falls out for free. After a move the pending actor is somebody else, and
 * in a game where one player acts twice in a row the actor does not change at
 * all, so no notice fires. It looks like an omission; it is not.
 *
 * @param previous - What the last publish recorded, if any.
 * @param header - The table view's header for this publish.
 * @param autoPlay - Which seats are currently played by the bot policy.
 * @param connected - User ids with an open socket on this game.
 * @returns The notice to send (if any) and the state to record for next time.
 */
export const decideNotice = (
	previous: NoticeState | undefined,
	header: GameHeader,
	autoPlay: Record<PlayerId, boolean>,
	connected: ReadonlySet<UserId>
) => {
	const actor = pendingActor( header.context );
	const carry = ( actor ? { actor } : {} ) satisfies Partial<NoticeState>;

	// A finished game has nobody to wait for. Reset so that a later undo which
	// reopens play reads as a fresh handover rather than a republish.
	if ( header.status === "COMPLETED" ) {
		return { state: { status: header.status } } satisfies NoticeDecision;
	}

	const state: NoticeState = { status: header.status, ...carry };

	/** A seat worth notifying: a real person, present, and not machine-played. */
	const isNotifiable = ( id: PlayerId ) =>
		header.players[ id ]?.isBot !== true
		&& autoPlay[ id ] !== true
		&& !connected.has( UserId.make( id ) );

	if ( header.status !== "IN_PROGRESS" ) {
		return { state } satisfies NoticeDecision;
	}

	// First sighting of this game — nothing was recorded before now. Take note of
	// where it stands and say nothing: without a previous state there is no way
	// to tell "just started" from "has been running for an hour", and guessing
	// wrong means every in-progress game shouting at its players the first time
	// it publishes after a deploy. Nothing is lost, because a game always
	// publishes at least once while being created, long before it goes live.
	if ( !previous ) {
		return { state } satisfies NoticeDecision;
	}

	// The table just went live. This is the one notice that reaches everyone, and
	// the moment players are most likely to have put their phones down.
	if ( previous.status !== "IN_PROGRESS" ) {
		const recipients = Object.keys( header.players )
			.filter( id => isNotifiable( PlayerId.make( id ) ) )
			.map( id => UserId.make( id ) );

		return ( recipients.length > 0
			? { notice: { kind: "start", recipients }, state }
			: { state } ) satisfies NoticeDecision;
	}

	// The same actor as last time means this publish was a republish — a chat
	// message, an autoplay toggle, a healed record — and not a handover.
	if ( !actor || actor === previous.actor ) {
		return { state } satisfies NoticeDecision;
	}

	return ( isNotifiable( actor )
		? { notice: { kind: "turn", recipients: [ UserId.make( actor ) ] }, state }
		: { state } ) satisfies NoticeDecision;
};

/**
 * Sends a decided notice.
 *
 * Deliberately *not* declared in `services.ts`: that file is the engine's
 * contract, and putting this beside it would imply the engine depends on it.
 * It does not — the notifier is composed into the sync layer instead, because
 * "who has an open socket" is knowledge the transport owns and the engine is
 * kept pure of.
 */
export class SwishNotifier extends Context.Service<SwishNotifier, {
	readonly announce: ( notice: Notice, header: GameHeader ) => Effect.Effect<void>;
}>()( "swish/Notifier" ) {}
