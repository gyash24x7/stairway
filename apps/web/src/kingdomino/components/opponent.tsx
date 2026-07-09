"use client";

import { RSmallBoard } from "@/kingdomino/components/board";
import { useKingdomino } from "@/kingdomino/components/context";
import { RSmallDomino } from "@/kingdomino/components/domino";
import { DOMINO_DECK } from "@s2h/kingdomino-core/utils";
import { RPlayerInfoSmall } from "@/shared/components/player-info";
import type { PlayerId } from "@s2h/engine/types";
import { cn } from "@s2h/shared/utils/cn";

export function ROpponent( { playerId }: { playerId: PlayerId } ) {
	const { shared } = useKingdomino();
	const playerData = shared.state.playerData[ playerId ];
	return (
		<div className={ "flex flex-col bg-background rounded-md overflow-hidden" }>
			<div className={ "flex gap-2 items-center bg-accent" }>
				<RPlayerInfoSmall player={ shared.players[ playerId ] }/>
				<div className={ "flex flex-col gap-2 flex-1" }>
					<div className={ "mt-2 flex gap-2" }>
						{ playerData.queue.toSorted().map( dominoId => (
							<RSmallDomino
								domino={ DOMINO_DECK[ dominoId - 1 ] }
								key={ dominoId }
								enabled={ false }/>
						) ) }
					</div>
					<p className={ "text-xs" }>QUEUE</p>
				</div>
				<div className={ "flex flex-col gap-2 justify-center items-center px-4 py-2" }>
					<span className={ cn( "text-2xl md:text-4xl font-heading" ) }>
						{ playerData.score.points ?? 0 }
					</span>
				</div>
			</div>
			<div className={ "p-4 flex justify-center items-center" }>
				<RSmallBoard board={ playerData.board }/>
			</div>
		</div>
	);
}