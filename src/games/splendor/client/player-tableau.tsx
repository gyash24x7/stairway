"use client";

import { motion } from "framer-motion";

import { useSplendor } from "@/games/splendor/client/context.tsx";
import { gemLightColors } from "@/games/splendor/client/utils.tsx";
import { GEMS } from "@/games/splendor/shared/utils.ts";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RPlayerInfoStrip } from "@/swish/client/player-info.tsx";

import type { PlayerId } from "@/swish/shared/schema.ts";

export type PlayerTableauProps = {
	playerId: PlayerId;
	large?: boolean;
};

/**
 * One player's development-card tableau, laid out face-up beneath a strip naming
 * whose it is. The gem counters on `PlayerInfo` only report *how many* of each
 * colour a player holds; this is the end-of-game reveal of exactly which cards
 * built that engine.
 *
 * Cards are grouped by the bonus gem they discount and then ordered cheapest
 * level first, so every seat's tableau reads the same way regardless of the order
 * the cards were actually bought.
 */
export function PlayerTableau( { playerId, large }: PlayerTableauProps ) {
	const { data } = useSplendor();
	const player = data.players[ playerId ];
	const cards = data.view.playerData[ playerId ]?.cards ?? [];

	return (
		<div className={ cn( "flex flex-col bg-background rounded-md overflow-hidden" ) }>
			<div className={ "flex items-center justify-between gap-2 p-2 bg-accent" }>
				<RPlayerInfoStrip player={ player }/>
				<span className={ "text-sm md:text-base font-heading text-neutral-dark pr-1" }>
					{ cards.length } { cards.length === 1 ? "CARD" : "CARDS" }
				</span>
			</div>
			{ cards.length > 0 ? (
				<div className={ "flex flex-wrap gap-2 md:gap-3 justify-center p-4" }>
					{ GEMS.map( gem => {
						const count = cards.filter( c => c.bonus === gem ).length;

						return (
							<motion.div
								key={ `${ gem }-${ count }` }
								animate={ { scale: [ 1, 1.2, 1 ] } }
								transition={ { duration: 0.45 } }
								className={ cn(
									// Bigger than the old 8x12 chip: this is the end-of-game
									// reveal of a seat's engine, not a status dot.
									"w-14 h-20 md:w-16 md:h-24 p-1.5 shrink-0",
									"flex flex-col rounded-md items-center justify-center gap-1",
									"border-2 border-outline",
									"text-2xl md:text-3xl font-heading text-neutral-dark",
									large && "w-24 h-36 md:w-24 md:h-36 text-5xl gap-2 rounded-lg",
									gemLightColors[ gem ]
								) }
							>
								{ /* The swatch names the gem the count belongs to — the tint
								     alone was doing that job and two of them read alike. */ }
								<img
									src={ `/splendor/tokens/${ gem }.svg` }
									className={
										cn(
											"w-8 h-8 md:w-10 md:h-10",
											large && "md:w-14 md:h-14"
										) }
								/>
								<span>{ count }</span>
							</motion.div>
						);
					} ) }
				</div>
			) : (
				<div className={ "p-4 text-xs md:text-sm text-center text-muted-foreground" }>
					NO CARDS PURCHASED
				</div>
			) }
		</div>
	);
}
