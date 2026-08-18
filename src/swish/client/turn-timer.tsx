"use client";

import { motion } from "framer-motion";
import { TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/shared/ui/utils/cn.ts";

/** Below this the clock turns urgent and starts pulsing. */
const URGENT_MILLIS = 10_000;

/** How often the readout is recomputed. Fast enough that seconds never skip. */
const TICK_MILLIS = 250;

export type TurnTimerProps = {
	/** When the pending actor's clock runs out, from the `GameView` envelope. */
	deadline?: number;
	/** Television sizing — used by the couch screen's turn banner. */
	large?: boolean;
	className?: string;
};

const format = ( millis: number ) => {
	const total = Math.ceil( millis / 1000 );
	const minutes = Math.floor( total / 60 );
	const seconds = total % 60;
	return `${ minutes }:${ String( seconds ).padStart( 2, "0" ) }`;
};

/**
 * The clock the pending seat is racing.
 *
 * `deadline` is an absolute instant the server published, not a duration, so
 * this needs no synchronisation beyond the two clocks being roughly in step —
 * and it survives a reload, a reconnect and a tab that was backgrounded, none of
 * which a locally counted-down duration would.
 *
 * Renders nothing when the table keeps no clock, or when the one it keeps has
 * already run out: an expired deadline belongs to a turn on its way to being
 * settled, and a timer stuck at zero reads as a hung game.
 */
export function TurnTimer( { deadline, large, className }: TurnTimerProps ) {
	const [ now, setNow ] = useState( () => Date.now() );

	useEffect( () => {
		if ( deadline === undefined ) {
			return;
		}

		setNow( Date.now() );
		const handle = setInterval( () => setNow( Date.now() ), TICK_MILLIS );
		return () => clearInterval( handle );
	}, [ deadline ] );

	if ( deadline === undefined ) {
		return null;
	}

	const remaining = deadline - now;
	if ( remaining <= 0 ) {
		return null;
	}

	const urgent = remaining <= URGENT_MILLIS;

	return (
		<motion.div
			className={ cn(
				"flex items-center gap-1.5 shrink-0 font-heading tabular-nums",
				large ? "gap-3 text-5xl" : "text-lg",
				urgent ? "text-destructive" : "text-muted-foreground",
				className
			) }
			animate={ urgent ? { scale: [ 1, 1.08, 1 ] } : { scale: 1 } }
			transition={ urgent
				? { duration: 1, repeat: Infinity, ease: "easeInOut" }
				: { duration: 0.2 }
			}
		>
			<TimerIcon className={ cn( "shrink-0", large ? "w-10 h-10" : "w-4 h-4" ) }/>
			<span>{ format( remaining ) }</span>
		</motion.div>
	);
}
