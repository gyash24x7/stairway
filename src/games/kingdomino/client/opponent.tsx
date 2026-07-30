"use client";

import { DOMINO_DECK } from "@/games/kingdomino/shared/utils.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";
import { RPlayerInfoSmall } from "@/shared/ui/components/player-info.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RSmallBoard } from "@/games/kingdomino/client/board.tsx";
import { useKingdomino } from "@/games/kingdomino/client/context.tsx";
import { RSmallDomino } from "@/games/kingdomino/client/domino.tsx";

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