"use client";

import type { PlayerId } from "@s2h/schema/swish";
import { RPlayerInfoSmall } from "@s2h/ui/components/player-info";
import { cn } from "@s2h/ui/utils/cn";
import { DOMINO_DECK } from "@s2h/utils/kingdomino";
import { RSmallBoard } from "./board";
import { useKingdomino } from "./context";
import { RSmallDomino } from "./domino";

export function ROpponent( { playerId }: { playerId: PlayerId } ) {
	const { data } = useKingdomino();
	const playerData = data.view.playerData[ playerId ];
	return (
		<div className={ "flex flex-col bg-background rounded-md overflow-hidden" }>
			<div className={ "flex gap-2 items-center bg-accent" }>
				<RPlayerInfoSmall player={ data.players[ playerId ] }/>
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