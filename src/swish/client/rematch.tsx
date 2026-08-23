"use client";

import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { GameRef, RematchInput } from "@/swish/shared/schema.ts";

/**
 * Which screen a rematch opens on.
 *
 * A phone that was driving a television is still a phone afterwards, so the
 * controller sends its player to the new game's controller rather than to the
 * full page. Passed in rather than read off the current path: every mount site
 * knows which of the two it is at build time, so asking the router at runtime
 * would be guessing at something already known.
 */
export type RematchScreen = "page" | "controller";

export type RematchProps = {
	/** The game's name — the first segment of the route the rematch lives at. */
	game: string;
	/** Whether the table has finished. Renders nothing before it has. */
	completed: boolean;
	/** Which screen to open the rematch on. Defaults to the full page. */
	screen?: RematchScreen;
	/**
	 * The game this table already agreed to play next, pushed onto the finished
	 * game's envelope over the socket. Its presence turns the control from an
	 * offer into a door: the game exists and everyone here is already seated in
	 * it, so there is nothing left to decide.
	 */
	rematch?: GameRef;
	/**
	 * Starts one. Omitted for a screen that must not offer it — a spectator's —
	 * and omitting it renders nothing at all.
	 */
	startRematch?: ( input: RematchInput, onDone: ( ref: GameRef ) => void ) => void;
	/** Whether the table is played in sides. */
	teams?: boolean;
	/** Non-bot seats. One means there is nobody to demand a rematch of. */
	humans: number;
	disabled?: boolean;
	className?: string;
};

/**
 * The one control a finished table still has: play these people again.
 *
 * It has two states, and which one shows is the server's answer rather than this
 * client's guess. Before anyone has asked it offers to create — twice over for a
 * team game, because carrying the sides across is a real choice and the moment
 * to make it is now. Once anyone has asked, the rematch is a fact on every
 * connected view and everyone is offered the door instead. There is deliberately
 * no third state in which two people each hold half a decision.
 *
 * Creating and joining are never the same button in different words: one spends
 * a round trip and the other does not, and the second carries the new game's
 * code so it can be read out to whoever closed their tab.
 *
 * The copy follows the table rather than the game. A seat with no human opponent
 * is not something you demand a rematch of, so a solo wordle and a tictactoe
 * against a bot both read `PLAY AGAIN` — which a per-game label would have got
 * right for one and wrong for the other.
 */
export function Rematch( props: RematchProps ) {
	const { game, screen = "page", rematch, startRematch, teams, disabled } = props;
	const navigate = useNavigate();

	if ( !props.completed || !startRematch ) {
		return null;
	}

	const open = ( ref: GameRef ) => void navigate( {
		to: screen === "controller" ? `/${ game }/$gameId/controller` : `/${ game }/$gameId`,
		params: { gameId: ref.id }
	} );

	const solo = props.humans <= 1;
	const wrapper = cn( "flex flex-col gap-2 items-center w-full", props.className );

	if ( rematch ) {
		return (
			<div className={ wrapper }>
				{ !solo && (
					<p className={ "text-xs md:text-sm text-muted-foreground" }>
						SOMEONE STARTED ANOTHER GAME
					</p>
				) }
				<Button onClick={ () => open( rematch ) }>
					{ solo ? "PLAY AGAIN" : `JOIN REMATCH — ${ rematch.code }` }
				</Button>
			</div>
		);
	}

	if ( teams ) {
		return (
			<div className={ wrapper }>
				<p className={ "text-xs md:text-sm text-muted-foreground" }>
					PLAY AGAIN — KEEP THE SIDES, OR PICK AGAIN?
				</p>
				<div className={ "flex gap-2 flex-wrap justify-center" }>
					<Button
						onClick={ () => startRematch( { keepTeams: true }, open ) }
						disabled={ disabled }
					>
						{ disabled ? <Spinner/> : "SAME TEAMS" }
					</Button>
					<Button
						variant={ "neutral" }
						onClick={ () => startRematch( { keepTeams: false }, open ) }
						disabled={ disabled }
					>
						{ disabled ? <Spinner/> : "SWITCH TEAMS" }
					</Button>
				</div>
			</div>
		);
	}

	return (
		<Button
			onClick={ () => startRematch( { keepTeams: false }, open ) }
			disabled={ disabled }
			className={ props.className }
		>
			{ disabled ? <Spinner/> : solo ? "PLAY AGAIN" : "REMATCH" }
		</Button>
	);
}

/**
 * The television's half of a rematch: a sign, not a control.
 *
 * `CouchShell` is button-free by design — a television across a room has no
 * pointer — so the shared screen states the fact and the code, and the room acts
 * on a phone. Renders nothing until a rematch exists, so it is safe to mount
 * unconditionally.
 */
export function RematchNotice( props: { rematch?: GameRef; className?: string } ) {
	if ( !props.rematch ) {
		return null;
	}

	return (
		<div
			className={ cn(
				"rounded-md bg-background border-2 border-outline px-8 py-4 text-center",
				props.className
			) }
		>
			<p className={ "text-4xl font-heading" }>REMATCH STARTED</p>
			<p className={ "text-2xl text-muted-foreground" }>
				JOIN ON YOUR PHONE — CODE { props.rematch.code }
			</p>
		</div>
	);
}

/**
 * How long a television keeps showing the standings before following the room to
 * the next game. Long enough to read a four-seat result out loud.
 */
const REMATCH_GRACE_MS = 10_000;

/**
 * Sends a screen that takes no input to the rematch on its own.
 *
 * A television cannot be asked to follow, and the alternative is somebody
 * walking across the room to a device whose whole point is that nobody has to.
 * It waits first, because the standings it is showing are why the room is still
 * looking at it.
 *
 * Keyed on the id rather than the ref, which is a fresh object on every socket
 * frame: this must arm once, not on every push.
 *
 * @param game - The game's name, for the couch route.
 * @param rematch - The game this table moved on to, once it has one.
 */
export function useFollowRematch( game: string, rematch?: GameRef ) {
	const navigate = useNavigate();
	const id = rematch?.id;

	useEffect( () => {
		if ( !id ) {
			return;
		}

		const timeout = setTimeout(
			() => void navigate( { to: `/${ game }/$gameId/couch`, params: { gameId: id } } ),
			REMATCH_GRACE_MS
		);

		return () => clearTimeout( timeout );
	}, [ game, id, navigate ] );
}
