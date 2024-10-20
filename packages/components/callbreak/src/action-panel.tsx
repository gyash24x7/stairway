import { cn } from "@stairway/components/base";
import { useCurrentDeal, useCurrentRound, useGameId, useGameStatus, usePlayerId } from "@stairway/stores/callbreak";
import { Fragment } from "react";
import { DeclareDealWinsDrawer } from "./declare-deal-wins-drawer.tsx";
import { AddBots } from "./game-actions.tsx";
import { PlayCardDrawer } from "./play-card-drawer.tsx";

export function ActionPanel() {
	const gameId = useGameId();
	const status = useGameStatus();
	const playerId = usePlayerId();
	const deal = useCurrentDeal();
	const round = useCurrentRound();

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "CREATED" && <AddBots gameId={ gameId }/> }
				{ status === "IN_PROGRESS" && !!deal && (
					<Fragment>
						{ deal.status === "CREATED" && deal.playerOrder[ deal.turnIdx ] === playerId && (
							<DeclareDealWinsDrawer/>
						) }
						{ deal.status === "IN_PROGRESS" && !!round && !round.completed && (
							<Fragment>
								{ playerId === round.playerOrder[ round.turnIdx ] && <PlayCardDrawer/> }
							</Fragment>
						) }
					</Fragment>
				) }
			</div>
		</div>
	);
}