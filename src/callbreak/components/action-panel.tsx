"use client";

import { DeclareDealWins } from "@/callbreak/components/declare-deal-wins";
import { PlayCard } from "@/callbreak/components/play-card";
import { store } from "@/callbreak/store";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";

export function ActionPanel() {

	const status = useStore( store, state => state.game.status );
	const playerId = useStore( store, state => state.playerId );
	const deal = useStore( store, state => state.currentDeal );
	const round = useStore( store, state => state.currentRound );
	const currentTurn = useStore( store, state => state.game.currentTurn );

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-white border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "IN_PROGRESS" && !!deal && (
					<Fragment>
						{ deal.status === "CREATED" && currentTurn === playerId && (
							<DeclareDealWins/>
						) }
						{ deal.status === "IN_PROGRESS" && !!round && round.status === "IN_PROGRESS" && (
							<Fragment>
								{ playerId === currentTurn && <PlayCard/> }
							</Fragment>
						) }
					</Fragment>
				) }
			</div>
		</div>
	);
}