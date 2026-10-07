import { cn } from "cn";
import { motion } from "framer-motion";
import { CoinsIcon } from "lucide-react";

import type { CoupView } from "@/games/coup/schema";
import { COUP_STARTING_INFLUENCE } from "@/games/coup/schema";
import { CoupCardBack, CoupCardTile } from "@/games/coup/ui/card";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import type { InteractionFrame, PlayerId, PlayerInfo } from "@/swish/schema";
import { responseOf } from "@/swish/utils";


/**
 * What a seat is saying to the open window, in one word.
 *
 * A window is a conversation the whole table is having at once, and the only way
 * to follow it is to see who has already spoken. Rendering nothing for a seat
 * still being waited on is deliberate: the absence is the state.
 */
const responseLabel = ( frame: InteractionFrame | undefined, playerId: PlayerId ) => {
	if ( !frame ) {
		return undefined;
	}

	if ( frame.pending.includes( playerId ) ) {
		return "THINKING…";
	}

	const response = responseOf( frame, playerId );
	if ( !response ) {
		return undefined;
	}

	if ( response.outcome === "passed" ) {
		return "ALLOWED";
	}

	if ( response.outcome === "expired" ) {
		return "TIMED OUT";
	}

	return response.move?.toUpperCase();
};

export type CoupPlayerRowProps = {
	readonly player: PlayerInfo;
	readonly view: CoupView;
	readonly isMe: boolean;
	readonly isCurrentTurn: boolean;
	/** The open window, for the line saying what this seat has said to it. */
	readonly frame?: InteractionFrame;
	/** Offered as a target for the action being composed, and what happens on a tap. */
	readonly onTarget?: () => void;
	readonly isTargetSelected?: boolean;
};

/**
 * One seat: who they are, what they hold, and what they have left.
 *
 * Coins and influence sit together because they are the only two resources in the
 * game and every decision is a trade between them — seven coins is a card, three
 * is an attempt at one. Face-up cards stay on the row for the rest of the game
 * rather than being cleared, since what somebody has already lost is the only
 * thing anybody knows for certain about them.
 */
export function CoupPlayerRow( props: CoupPlayerRowProps ) {
	const { player, view, isMe, isCurrentTurn, frame, onTarget, isTargetSelected } = props;

	const influence = view.influence[ player.id ] ?? 0;
	const coins = view.coins[ player.id ] ?? 0;
	const lostCount = Math.max( 0, COUP_STARTING_INFLUENCE - influence );
	const myLosses = isMe ? view.lost : [];
	const isOut = view.eliminated.includes( player.id );
	const isPendingAction = view.pending?.actor === player.id;
	const isPendingTarget = view.pending?.target === player.id;
	const isBlocker = view.pending?.blocker === player.id;

	const status = isOut ? "OUT" : responseLabel( frame, player.id );
	const targetable = !!onTarget && !isOut;

	return (
		<motion.div
			layout
			className={ cn(
				"flex w-full flex-col gap-2 rounded-md border-2 p-3 transition",
				isOut ? "border-outline bg-background/50 opacity-60" : "border-outline bg-background",
				// Accent means "you" throughout the app, so it fills the seat being
				// asked to act and never merely the seat being looked at.
				isCurrentTurn && !isOut && "border-accent",
				isPendingTarget && "ring-2 ring-destructive",
				isTargetSelected && "ring-2 ring-accent"
			) }
		>
			<div className={ "flex items-center gap-3" }>
				<Avatar className={ "h-9 w-9 shrink-0 rounded-full md:h-10 md:w-10" }>
					<AvatarImage src={ player.avatar } alt={ "" } className={ "bg-background" }/>
				</Avatar>

				<div className={ "flex min-w-0 flex-col" }>
					<span className={ "truncate font-heading text-sm md:text-base" }>
						{ player.name.split( " " )[ 0 ]?.toUpperCase() }
						{ isMe && <span className={ "text-accent" }>{ " (YOU)" }</span> }
					</span>
					{ !!status && (
						<span className={ "text-xs text-muted-foreground" }>{ status }</span>
					) }
				</div>

				<div className={ "ml-auto flex shrink-0 items-center gap-1 font-heading" }>
					<CoinsIcon className={ "h-4 w-4 text-amber-500" }/>
					<span className={ "tabular-nums" }>{ coins }</span>
				</div>

				{ targetable && (
					<button
						type={ "button" }
						onClick={ onTarget }
						className={ cn(
							"shrink-0 rounded-base border-2 border-outline px-2 py-1",
							"font-heading text-xs transition hover:brightness-110",
							isTargetSelected ? "bg-accent text-neutral-dark" : "bg-surface"
						) }
					>
						{ isTargetSelected ? "TARGETED" : "TARGET" }
					</button>
				) }
			</div>

			<div className={ "flex flex-wrap items-stretch gap-1" }>
				{ Array.from( { length: influence }, ( _, index ) => (
					<CoupCardBack key={ `back-${ index }` } small/>
				) ) }
				{ isMe
					? myLosses.map( ( card, index ) => (
						<CoupCardTile key={ `lost-${ index }-${ card }` } card={ card } small spent/>
					) )
					: Array.from( { length: lostCount }, ( _, index ) => (
						<CoupCardBack key={ `lost-${ index }` } small lost/>
					) ) }
			</div>

			{ ( isPendingAction || isPendingTarget || isBlocker ) && !isOut && (
				<p className={ "text-xs text-muted-foreground" }>
					{ isPendingAction && "Declared this action" }
					{ isPendingTarget && "Targeted by this action" }
					{ isBlocker && "Standing up to block" }
				</p>
			) }
		</motion.div>
	);
}
