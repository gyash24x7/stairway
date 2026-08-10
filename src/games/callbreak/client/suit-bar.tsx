"use client";

import { RCardSuit } from "@/shared/ui/components/card.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { useCallbreakBoard } from "@/games/callbreak/client/context.tsx";

/**
 * Trump and lead suit, side by side. The two facts a player checks before every
 * card, so they get their own bar rather than sharing one with the trick.
 */
export function SuitBar() {
	const { data } = useCallbreakBoard();
	const trick = data.view.activeDeal?.tricks[ 0 ];

	return (
		<div className={ "grid grid-cols-2 gap-2 w-full" }>
			<div
				className={ cn(
					"flex flex-col items-center justify-center gap-1",
					"bg-background rounded-md py-2"
				) }
			>
				<span className={ "text-xs tracking-widest text-foreground/70" }>TRUMP</span>
				<RCardSuit suit={ data.config.trumpSuit } large themed/>
			</div>
			<div
				className={ cn(
					"flex flex-col items-center justify-center gap-1",
					"bg-background rounded-md py-2"
				) }
			>
				<span className={ "text-xs tracking-widest text-foreground/70" }>LEAD</span>
				{ trick?.suit
					? <RCardSuit suit={ trick.suit } large/>
					: <span className={ "text-2xl md:text-4xl text-foreground/40" }>—</span> }
			</div>
		</div>
	);
}
