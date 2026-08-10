"use client";

import { GEMS } from "@/games/splendor/shared/utils.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";
import { RPlayerInfoStrip } from "@/shared/ui/components/player-info.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { useSplendorBoard } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";

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
export function PlayerTableau( { playerId }: { playerId: PlayerId } ) {
	const { data } = useSplendorBoard();
	const player = data.players[ playerId ];
	const cards = data.view.playerData[ playerId ]?.cards ?? [];

	const ordered = GEMS.flatMap( gem => cards
		.filter( card => card.bonus === gem )
		.toSorted( ( a, b ) => a.level - b.level ) );

	return (
		<div className={ "flex flex-col bg-background rounded-md overflow-hidden" }>
			<div className={ "flex items-center justify-between gap-2 p-2 bg-accent" }>
				<RPlayerInfoStrip player={ player }/>
				<span className={ "text-sm md:text-base font-heading text-neutral-dark pr-1" }>
					{ cards.length } { cards.length === 1 ? "CARD" : "CARDS" }
				</span>
			</div>
			{ ordered.length > 0 ? (
				<div className={ cn( "flex flex-wrap gap-1 md:gap-2 justify-center p-4" ) }>
					{ ordered.map( card => <GameCard key={ card.id } card={ card } disabled/> ) }
				</div>
			) : (
				<div className={ "p-4 text-xs md:text-sm text-center text-muted-foreground" }>
					NO CARDS PURCHASED
				</div>
			) }
		</div>
	);
}
