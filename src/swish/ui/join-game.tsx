import * as Exit from "effect/Exit";

import { useEffect, useState, useTransition } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/shared/primitives/dialog";
import { toast } from "@/shared/primitives/sonner";
import { causeMessage } from "@/shared/shell/errors";
import type { GameId, GameStatus, PlayerInfo } from "@/swish/schema";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";


export type JoinGameProps = {
	/** The game's name — the first path segment, and what the copy calls it. */
	readonly game: string;
	readonly gameId: GameId;
	/** Who is already at the table, bots included. */
	readonly seated: ReadonlyArray<PlayerInfo>;
	readonly playerCount: number;
	readonly status: GameStatus;
	/** Whether the caller already holds a seat here. */
	readonly isMember: boolean;
	readonly onJoin: () => Promise<Exit.Exit<unknown, unknown>>;
	/** Takes a place in the audience rather than at the table. */
	readonly onSpectate: () => Promise<Exit.Exit<unknown, unknown>>;
};

/**
 * The question at the end of an invite link: do you want to sit down here?
 *
 * Every way into a game that is not creating one arrives here — the link the
 * creator copies and the JOIN button in the lobby are the same URL — so this is
 * the single place that decides what taking a seat looks like, and the only
 * place that has to get the awkward cases right.
 *
 * There are three, and each is answered before the dialog is drawn rather than
 * by letting the click fail:
 *
 * - **Already seated.** Asking somebody whether they would like to join a game
 *   they are already playing is a question with no useful answer, so they are
 *   sent straight to the table. This is also what makes the link safe to re-open
 *   and safe to share back into a group where half the table already followed it.
 * - **Under way.** The seats are gone, so there is no JOIN button to offer — it
 *   could only produce `GameNotJoinable`. Watching is offered instead, and this
 *   is the branch where it matters most: a table already playing is the one
 *   somebody following a link is most likely to have come to see.
 * - **Finished.** Nothing left to join and nothing left to watch. A completed
 *   game is dropped from the hot store, so even the audience has nowhere to
 *   stand, and the way back is all there is.
 * - **Declined.** Dismissing the dialog is not a dead end: it lands on the
 *   game's home page, where the lobby lists the tables that *are* open.
 *
 * Watching is a deliberate ask rather than something the table grants by being
 * looked at. The engine has always shown a non-member the table's redacted
 * view; what this button adds is the record — it puts the caller into the
 * audience everyone else can see, and it is what the game page checks before
 * letting a stranger in.
 *
 * The seats come from the caller's own live view rather than being fetched
 * here, because a non-member already gets the table audience's view of a
 * `CREATED` game — so the dialog shows who is waiting, and keeps showing it as
 * people arrive while the reader makes up their mind.
 */
export function JoinGame( props: JoinGameProps ) {
	const { game, gameId, seated, playerCount, status, isMember, onJoin, onSpectate } = props;

	const navigate = useNavigate();
	const [ isPending, startTransition ] = useTransition();
	const [ open, setOpen ] = useState( true );

	const table = `/${ game }/${ gameId }`;
	const home = `/${ game }`;
	const joinable = status === "CREATED";

	// Watching outlives joining by the whole length of the game, which is the
	// point of it — but not past the end. A completed game is dropped from the
	// hot store the moment it is archived, so there is no live document left to
	// watch and the ask would only come back `GameNotFound`.
	const watchable = status !== "COMPLETED";

	// A seat the caller already holds is not a decision. Done as an effect rather
	// than a redirect element so that it also fires on the join that *succeeds* —
	// the live view reports the new seat, and this is what follows it to the table.
	useEffect( () => {
		if ( isMember ) {
			void navigate( table, { replace: true } );
		}
	}, [ isMember, navigate, table ] );

	if ( isMember ) {
		return null;
	}

	const leave = () => {
		setOpen( false );
		void navigate( home );
	};

	const handleJoin = () => startTransition( async () => {
		const exit = await onJoin();
		if ( Exit.isFailure( exit ) ) {
			toast.error( causeMessage( exit.cause ) );
			return;
		}

		// `replace`, so Back returns to wherever the link was opened from rather
		// than to a dialog asking about a seat that has now been taken.
		void navigate( table, { replace: true } );
	} );

	const handleSpectate = () => startTransition( async () => {
		const exit = await onSpectate();
		if ( Exit.isFailure( exit ) ) {
			toast.error( causeMessage( exit.cause ) );
			return;
		}

		void navigate( table, { replace: true } );
	} );

	return (
		<Dialog open={ open } onOpenChange={ next => !next && leave() }>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{ joinable
							? `JOIN THIS ${ game.toUpperCase() } GAME?`
							: watchable
								? `WATCH THIS ${ game.toUpperCase() } GAME?`
								: "THIS GAME HAS FINISHED" }
					</DialogTitle>
					<DialogDescription>
						{ joinable
							? `${ seated.length } of ${ playerCount } seats are taken.`
							: watchable
								? "Every seat is taken, but you can still pull up a chair and watch."
								: "There is nothing left to join or to watch." }
					</DialogDescription>
				</DialogHeader>

				{ seated.length > 0 && (
					<PlayerLobbyGrid
						players={ seated }
						seats={ joinable ? playerCount : undefined }
					/>
				) }

				<DialogFooter>
					<Button variant={ "neutral" } onClick={ leave }>
						{ joinable ? "NO THANKS" : `BACK TO ${ game.toUpperCase() }` }
					</Button>
					{ watchable && (
						<Button
							variant={ joinable ? "neutral" : "default" }
							onClick={ handleSpectate }
							disabled={ isPending }
						>
							{ isPending ? "PLEASE WAIT..." : "WATCH" }
						</Button>
					) }
					{ joinable && (
						<Button onClick={ handleJoin } disabled={ isPending }>
							{ isPending ? "JOINING..." : "JOIN GAME" }
						</Button>
					) }
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
