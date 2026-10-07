import { cn } from "cn";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { RCardSuit } from "@/shared/shell/card";
import type { GameView } from "@/swish/schema";

type Game = GameView<CallbreakView, CallbreakConfig>;

/**
 * Trump and lead suit, side by side. The two facts a player checks before every
 * card, so they get their own bar rather than sharing one with the trick.
 */
export function SuitBar( { game }: { game: Game } ) {
	const trick = game.view.activeDeal?.tricks[ 0 ];

	return (
		<div className={ "grid grid-cols-2 gap-2 w-full" }>
			<div
				className={ cn(
					"flex flex-col items-center justify-center gap-1",
					"bg-background rounded-md py-2"
				) }
			>
				<span className={ "text-xs tracking-widest text-muted-foreground" }>TRUMP</span>
				<RCardSuit suit={ game.config.trumpSuit } large themed/>
			</div>
			<div
				className={ cn(
					"flex flex-col items-center justify-center gap-1",
					"bg-background rounded-md py-2"
				) }
			>
				<span className={ "text-xs tracking-widest text-muted-foreground" }>LEAD</span>
				{ trick?.suit
					? <RCardSuit suit={ trick.suit } large/>
					: <span className={ "text-2xl md:text-4xl text-foreground/40" }>—</span> }
			</div>
		</div>
	);
}
