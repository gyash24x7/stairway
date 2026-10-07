import * as Exit from "effect/Exit";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import type * as Atom from "effect/reactivity/Atom";

import { cn } from "cn";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/shared/primitives/button";
import { toast } from "@/shared/primitives/sonner";
import { Spinner } from "@/shared/primitives/spinner";
import { causeMessage } from "@/shared/shell/errors";
import type { GameId, GameRef, GameStatus } from "@/swish/schema";
import { RematchInput } from "@/swish/schema";


/**
 * Which screen a rematch is followed onto.
 *
 * Somebody who finished on a phone controller wants the controller of the next
 * game, not its full page, and the television wants the next game's television
 * view — so the destination is the surface the reader is already on.
 */
export type RematchSurface = "page" | "controller" | "couch";

export const rematchPath = ( game: string, gameId: GameId, surface: RematchSurface ) =>
	surface === "page" ? `/${ game }/${ gameId }` : `/${ game }/${ gameId }/${ surface }`;

/**
 * What every rematch atom is asked for: the finished table, and whether the
 * sides come along. The endpoint is engine-owned, so this is the whole request
 * for all seven games.
 */
export type RematchRequest = { readonly params: GameRef; readonly payload: RematchInput };

export type RematchPanelProps<E> = {
	/** The game's name — the first path segment. */
	readonly game: string;
	readonly gameId: GameId;
	readonly status: GameStatus;
	/** `runtime.rematch`: the table this one's players moved on to, once anybody asked. */
	readonly rematch?: GameRef;
	/**
	 * Whether the reader played in this game. Only a member may ask for the
	 * rematch, and only a member has a seat waiting in it — a spectator is
	 * offered the audience of the next one instead.
	 */
	readonly seated: boolean;
	/** The game's `rematch` mutation atom. */
	readonly rematchAtom: Atom.AtomResultFn<RematchRequest, GameRef, E>;
	/**
	 * Offer the choice of keeping the sides. Only meaningful for a team game; a
	 * game without teams always asks with `keepTeams: false`, which the engine
	 * reads the same as keeping none.
	 */
	readonly teams?: boolean;
	readonly surface?: RematchSurface;
	readonly className?: string;
};

/**
 * Moves this screen onto the rematch the moment one exists.
 *
 * Driven by the live view rather than by the button, because the button is
 * pressed on one device and the table is spread across many: `runtime.rematch`
 * is pushed to every subscriber in the same commit, so this is what carries
 * the whole room — every player's page, every phone controller, the
 * television — over together.
 *
 * Always `replace`. The finished game would follow the rematch again the moment
 * it was shown, so leaving it in the history would turn Back into a loop that
 * lands right where it started.
 *
 * @param game - The game's name — the first path segment.
 * @param rematch - `runtime.rematch` of the game on screen.
 * @param surface - The screen to land on at the next table.
 * @param enabled - False to stay put, for a reader with no seat waiting.
 */
const useFollowRematch = (
	game: string,
	rematch: GameRef | undefined,
	surface: RematchSurface,
	enabled = true
) => {
	const navigate = useNavigate();
	const nextId = rematch?.gameId;

	useEffect( () => {
		if ( enabled && nextId ) {
			void navigate( rematchPath( game, nextId, surface ), { replace: true } );
		}
	}, [ enabled, game, navigate, nextId, surface ] );
};

/**
 * Play the same people again.
 *
 * Renders nothing until the game is over, so it is safe to mount
 * unconditionally beside `GameStandings`.
 *
 * There is one rematch per game, and the engine answers every ask after the
 * first with the table the first one made. So the button is the same for
 * everybody, and two people pressing it at once land at the same table. Every
 * seated player is moved there as soon as it exists — see `useFollowRematch` —
 * whoever pressed the button and wherever they are looking from.
 *
 * A spectator is the exception: they hold no seat at the next table, and the
 * audience is something asked for rather than granted, so they are offered it
 * instead of being moved.
 *
 * The new table is created full, so nobody joins it: arriving is the whole of
 * taking the seat.
 */
export function RematchPanel<E>( props: RematchPanelProps<E> ) {
	const { game, gameId, status, rematch, seated, rematchAtom, teams, className } = props;
	const surface = props.surface ?? "page";

	const navigate = useNavigate();
	const ask = useAtomSet( rematchAtom, { mode: "promiseExit" } );
	const asking = useAtomValue( rematchAtom ).waiting;

	useFollowRematch( game, rematch, surface, seated );

	if ( status !== "COMPLETED" ) {
		return null;
	}

	// Somebody who only watched has no seat to ask from, and nothing to say
	// until a player has.
	if ( !seated && !rematch ) {
		return null;
	}

	// The asker is moved on the reply as well as on the push, since either can
	// arrive first; both `replace`, so landing twice costs nothing.
	const askRematch = ( keepTeams: boolean ) => void ask( {
		params: { gameId },
		payload: RematchInput.make( { keepTeams } )
	} ).then( exit => {
		if ( Exit.isFailure( exit ) ) {
			toast.error( causeMessage( exit.cause ) );
			return;
		}

		void navigate( rematchPath( game, exit.value.gameId, surface ), { replace: true } );
	} );

	return (
		<div
			className={ cn(
				"p-3 rounded-md w-full bg-background",
				"flex flex-col gap-2 items-center text-center",
				className
			) }
		>
			{ rematch
				? seated
					? (
						// Only on screen for the moment before `useFollowRematch` lands.
						<div className={ "flex gap-2 items-center" }>
							<Spinner/>
							<p className={ "text-status" }>MOVING TO THE REMATCH</p>
						</div>
					)
					: (
						<>
							<p className={ "text-status" }>THE TABLE IS PLAYING AGAIN</p>
							{ /*
							   * Through `/join`, which is where a place in the audience is asked
							   * for — the table itself turns away anybody who is neither seated
							   * nor watching.
							   */ }
							<Link to={ `/${ game }/${ rematch.gameId }/join` }>
								<Button>WATCH THE REMATCH</Button>
							</Link>
						</>
					)
				: (
					<>
						<p className={ "text-status" }>PLAY AGAIN?</p>
						<p className={ "text-xs md:text-sm text-muted-foreground" }>
							Everyone from this game is seated at the next one, bots included.
						</p>
						<div className={ "flex gap-2 flex-wrap justify-center" }>
							{ teams
								? (
									<>
										<Button onClick={ () => askRematch( true ) } disabled={ asking }>
											{ asking ? <Spinner/> : "SAME TEAMS" }
										</Button>
										<Button
											variant={ "neutral" }
											onClick={ () => askRematch( false ) }
											disabled={ asking }
										>
											{ asking ? <Spinner/> : "NEW TEAMS" }
										</Button>
									</>
								)
								: (
									<Button onClick={ () => askRematch( false ) } disabled={ asking }>
										{ asking ? <Spinner/> : "REMATCH" }
									</Button>
								) }
						</div>
					</>
				) }
		</div>
	);
}

export type RematchNoticeProps = {
	readonly game: string;
	/** `runtime.rematch` of the game on screen. */
	readonly rematch?: GameRef;
};

/**
 * The television's half of a rematch, for `CouchShell`'s `notice` slot.
 *
 * A television has no pointer and no seat, so it follows unconditionally: it
 * moves to the next table's television view along with the phones, and the
 * strip — the next table's code — is only on screen for as long as that takes.
 *
 * The next table is private, but the view is not gated on membership, so the
 * television's own session can read it without having played.
 */
export function RematchNotice( { game, rematch }: RematchNoticeProps ) {
	useFollowRematch( game, rematch, "couch" );

	if ( !rematch ) {
		return null;
	}

	return (
		<div
			className={ cn(
				"bg-background rounded-lg px-8 py-5",
				"flex items-center justify-center gap-6 text-4xl font-heading"
			) }
		>
			<Spinner size={ "xl" }/>
			<span>MOVING TO THE REMATCH — CODE { rematch.gameId }</span>
		</div>
	);
}
