import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { GAMES, isGameName } from "@/shared/games";
import type { BaseGameConfig, GameRecord, GameRuntime, PlayerId } from "@/swish/schema";
import { activeFrame, isMachinePlayed } from "@/swish/utils";


/**
 * What a player is told when they are not looking, as it crosses the push
 * service and lands in the service worker (`src/sw.ts`).
 * - title: The game, as its own pages print it
 * - body: What happened, from the player's side of the table
 * - url: The page that answers it — the game, or the rematch
 * - tag: Which notices replace each other; one per game, so the newest about a
 * 		table is the only one left showing
 */
export type Notice = {
	readonly title: string;
	readonly body: string;
	readonly url: string;
	readonly tag: string;
};

/**
 * Why a player is being told something, most important first. When one write
 * gives a player several reasons — the game started *and* it is their turn —
 * they get one notice, for the reason earliest in this list.
 */
const KINDS = [ "completed", "respond", "turn", "started", "rematch", "joined" ] as const;
export type PushKind = typeof KINDS[ number ];

export type Push = {
	readonly playerId: PlayerId;
	readonly kind: PushKind;
	readonly notice: Notice;
};

/**
 * Where the engine hands off the notices a write produced.
 *
 * A seam rather than a dependency on any push service, for the same reason the
 * ledger is one: the engine decides *who* is told *what*, and nothing about how
 * it is delivered. The web-push implementation lives in `@/notifications`, and
 * the test harness records instead of sending.
 *
 * `notify` cannot fail and is never waited on — the engine forks it — because a
 * push service being slow or down is no reason for a move to be.
 */
export class Notifier extends Context.Service<Notifier, {
	readonly notify: ( pushes: ReadonlyArray<Push> ) => Effect.Effect<void>;
}>()( "swish/Notifier" ) {}

/** Tells nobody anything. For processes with no push service configured. */
export const NotifierNoop = Layer.succeed( Notifier, Notifier.of( { notify: () => Effect.void } ) );

const ordinal = ( n: number ) => {
	const tens = n % 100;
	const suffix = tens >= 11 && tens <= 13 ? "th" : [ "th", "st", "nd", "rd" ][ n % 10 ] ?? "th";
	return `${ n }${ suffix }`;
};

/**
 * Who the table is waiting on: the responders yet to answer the open window, or
 * the seat whose turn it is. Empty unless the game is being played.
 */
const pendingOf = <State, Config extends BaseGameConfig>( record: GameRecord<State, Config> | undefined ) => {
	if ( record?.status !== "IN_PROGRESS" ) {
		return [];
	}
	const frame = activeFrame( record.context );
	if ( frame ) {
		return frame.pending;
	}
	return record.context.currentPlayer === undefined ? [] : [ record.context.currentPlayer ];
};

/**
 * The notices one write to a game produces, worked out from the record before
 * and after it. Called from `persist`, the engine's single write path, so no
 * transition can reach a player without passing through here.
 *
 * It is a diff and not an event handler on purpose. The things worth telling
 * somebody — it became their turn, the table filled, the game ended — are facts
 * about positions, not about which command led there: a turn can arrive through
 * a move, a window closing, a timeout, or an undo, and asking "was this seat
 * waiting before?" covers every one of them without any of them having to
 * remember to.
 *
 * Only people are told anything. A bot's seat, or one handed to the bot policy
 * after a timeout, has nobody behind it to read the notice.
 *
 * - Your turn / respond: seats the game is now waiting on that it was not
 * 		waiting on before. Waiting on the same seat again — fish's ask-again —
 * 		is not news to somebody who is evidently already playing.
 * - Joined: the people already seated, when somebody else sits down. Not when
 * 		the table was empty a moment ago — that is the creator sitting at their
 * 		own table, or a rematch seating everybody at once — and not for bots,
 * 		which only the table's own creator can add.
 * - Started / completed: everybody seated, on the transition.
 * - Rematch: everybody seated at the finished game, pointing at the next one.
 *
 * @param game - The game's name, the first segment of its routes.
 * @param before - The record before the write, or `undefined` for the first write.
 * @param after - The record being written.
 * @param runtime - The runtime being written, for `autoPlay` and `rematch`.
 * @param previousRuntime - The runtime before the write, for `rematch`.
 * @returns At most one push per player.
 */
export const pushesFor = <State, Config extends BaseGameConfig>(
	game: string,
	before: GameRecord<State, Config> | undefined,
	after: GameRecord<State, Config>,
	runtime: GameRuntime,
	previousRuntime: GameRuntime | undefined
): ReadonlyArray<Push> => {
	const title = isGameName( game ) ? GAMES[ game ].title : game.toUpperCase();
	const url = `/${ game }/${ after.id }`;
	const tag = `${ game }:${ after.id }`;

	const humans = after.context.players.filter( id => !isMachinePlayed( after, runtime, id ) );
	const chosen = new Map<PlayerId, Push>();

	const offer = ( playerId: PlayerId, kind: PushKind, body: string, link = url ) => {
		if ( !humans.includes( playerId ) ) {
			return;
		}

		const existing = chosen.get( playerId );
		if ( existing && KINDS.indexOf( existing.kind ) <= KINDS.indexOf( kind ) ) {
			return;
		}

		chosen.set( playerId, { playerId, kind, notice: { title, body, url: link, tag } } );
	};

	const seatedBefore = before?.context.players ?? [];
	if ( seatedBefore.length > 0 ) {
		const joined = after.context.players.filter(
			id => !seatedBefore.includes( id ) && after.players[ id ]?.isBot !== true
		);

		for ( const joiner of joined ) {
			const name = after.players[ joiner ]?.name ?? "Somebody";
			const seats = `${ after.context.players.length }/${ after.config.playerCount }`;
			for ( const id of seatedBefore ) {
				offer( id, "joined", `${ name } joined your table (${ seats }).` );
			}
		}
	}

	if ( after.status === "IN_PROGRESS" && before?.status !== "IN_PROGRESS" ) {
		for ( const id of humans ) {
			offer( id, "started", "The game has started." );
		}
	}

	const waitingBefore = pendingOf( before );
	const responding = activeFrame( after.context ) !== undefined;
	for ( const id of pendingOf( after ) ) {
		if ( !waitingBefore.includes( id ) ) {
			offer(
				id,
				responding ? "respond" : "turn",
				responding ? "You need to respond." : "It's your turn."
			);
		}
	}

	if ( after.status === "COMPLETED" && before?.status !== "COMPLETED" ) {
		const results = after.results;
		for ( const id of humans ) {
			const standing = results?.ranking.find( entry => entry.playerId === id );
			const body = results?.winningTeam !== undefined && standing?.team !== undefined
				? standing.team === results.winningTeam ? "Your team won!" : "Your team lost."
				: standing === undefined
					? "The game is over."
					: standing.rank === 1
						? "You won!"
						: `You finished ${ ordinal( standing.rank ) } of ${ results!.ranking.length }.`;

			offer( id, "completed", body );
		}
	}

	if ( runtime.rematch && !previousRuntime?.rematch ) {
		const link = `/${ game }/${ runtime.rematch.gameId }`;
		for ( const id of humans ) {
			offer( id, "rematch", "A rematch is ready — same table, new game.", link );
		}
	}

	return [ ...chosen.values() ];
};
