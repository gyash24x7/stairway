"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { SPRING_TIGHT } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { GameStatus, PlayerId, Roster } from "@/swish/shared/schema.ts";

export type TurnTextOptions = {
	status: GameStatus;
	players: Roster;
	currentPlayer?: PlayerId;
	isMyTurn?: boolean;
	/**
	 * What the pending seat is doing, when a game's phase makes "their turn" too
	 * vague — `"DECLARING"`, `"PICKING A DOMINO"`. Omitted for a single-phase game.
	 */
	action?: string;
	/** A trailing clause the table needs to know about, e.g. `"LAST ROUND!"`. */
	note?: string;
	seated?: number;
	playerCount?: number;
	/**
	 * Television wording. A couch screen holds no seat and takes no input, so its
	 * lobby copy has to send the room to a phone rather than offer a button.
	 */
	couch?: boolean;
};

/**
 * The one place a turn is put into words.
 *
 * Every surface — the page banner, the phone's waiting line and the television's
 * footer — reads the same fact, so the phrasing lives here rather than in a
 * nested ternary per game per screen. Games differing only by phase pass
 * `action`; nothing else about the sentence is theirs to choose.
 *
 * @param options - The table's status and who it is waiting on.
 * @returns The line to show, already upper-cased.
 */
export const turnText = ( options: TurnTextOptions ) => {
	const { status, players, currentPlayer, isMyTurn, action, note, couch } = options;

	if ( status === "CREATED" ) {
		const count = options.seated !== undefined && options.playerCount !== undefined
			? ` — ${ options.seated }/${ options.playerCount } SEATED`
			: "";
		return couch
			? `WAITING FOR PLAYERS${ count } — ADD BOTS FROM A PHONE`
			: `WAITING FOR PLAYERS${ count }`;
	}

	if ( status === "PLAYERS_READY" ) {
		return couch ? "ALL PLAYERS JOINED — START FROM ANY PHONE" : "ALL PLAYERS JOINED";
	}

	if ( status === "COMPLETED" ) {
		return "GAME OVER";
	}

	const name = ( currentPlayer ? players[ currentPlayer ]?.name ?? "" : "" ).toUpperCase();
	const suffix = note ? ` — ${ note }` : "";

	if ( isMyTurn ) {
		return action ? `YOUR TURN — ${ action }${ suffix }` : `YOUR TURN${ suffix }`;
	}

	if ( !name ) {
		return `WAITING${ suffix }`;
	}

	return action ? `${ name } IS ${ action }${ suffix }` : `${ name }'S TURN${ suffix }`;
};

export type TurnBannerProps = TurnTextOptions & {
	className?: string;
};

/**
 * Whose turn it is, and what they can do about it.
 *
 * The handover is the animation: several games pass the turn on something other
 * than a completed move, so it moves often and often to someone who was not
 * expecting it — and on a phone, where the board is a list, a banner that merely
 * re-renders is easy to miss entirely. So the whole strip slides the outgoing
 * seat out and the incoming one in, keyed on the seat rather than the text, and
 * the avatar comes with it so the change is legible before the name is read.
 *
 * Renders nothing outside a game in progress: a lobby and a finished table are
 * `GameStatusPanel`'s and `GameStandings`' business respectively.
 */
export function TurnBanner( props: TurnBannerProps ) {
	const { players, currentPlayer, isMyTurn, className } = props;

	if ( props.status !== "IN_PROGRESS" || !currentPlayer ) {
		return null;
	}

	const current = players[ currentPlayer ];
	const text = turnText( props );

	return (
		<motion.div
			layout
			className={ cn(
				"p-2 md:p-3 rounded-md w-full overflow-hidden",
				// Accent means "you" throughout the app, so it fills only for the seat
				// actually being asked to move. The fill alone is the signal — a ring
				// pulsing behind it read as an alert rather than an indicator.
				isMyTurn ? "bg-accent text-neutral-dark" : "bg-background",
				className
			) }
		>
			<AnimatePresence mode={ "wait" } initial={ false }>
				<motion.div
					// Keyed on the seat: the turn moving is what plays, and re-phrasing
					// mid-turn (a claim that opens up a transfer) must not replay it.
					key={ currentPlayer }
					className={ "flex items-center justify-center" }
					initial={ { opacity: 0, x: 40 } }
					animate={ { opacity: 1, x: 0 } }
					exit={ { opacity: 0, x: -40 } }
					transition={ SPRING_TIGHT }
				>
					<div className={ "flex gap-2 items-center min-w-0" }>
						{ !!current && (
							<motion.span
								initial={ { scale: 0.4 } }
								animate={ { scale: 1 } }
								transition={ { ...SPRING_TIGHT, delay: 0.05 } }
							>
								<Avatar className={ "rounded-full w-7 h-7 md:w-9 md:h-9" }>
									<AvatarImage src={ current.avatar } alt={ "" } className={ "bg-background" }/>
								</Avatar>
							</motion.span>
						) }
						<p className={ "text-status truncate" }>{ text }</p>
					</div>
				</motion.div>
			</AnimatePresence>
		</motion.div>
	);
}
