"use client";

import { cn } from "@s2h-ui/primitives/utils";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";
import { AskCard } from "./ask-card";
import { AskHistory } from "./ask-history";
import { ClaimBook } from "./claim-book";
import { CreateTeams } from "./create-teams";
import { StartGame } from "./start-game";
import { store } from "./store";
import { TransferTurn } from "./transfer-turn";

export function ActionPanel() {
	const status = useStore( store, state => state.status );
	const currentTurn = useStore( store, state => state.currentTurn );
	const playerId = useStore( store, state => state.playerId );
	const players = useStore( store, state => state.players );
	const isLastMoveSuccessfulCall = useStore(
		store,
		( { lastMoveType, claimHistory } ) => lastMoveType === "claim" && claimHistory[ 0 ]?.success
	);

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center bg-white"
			) }
		>
			{ status === "IN_PROGRESS" && (
				<div className={ "p-2 md:p-3 border-2 rounded-md w-full bg-bg max-w-lg" }>
					<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
						IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
					</p>
				</div>
			) }
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "PLAYERS_READY" && playerId === currentTurn && <CreateTeams/> }
				{ status === "TEAMS_CREATED" && playerId === currentTurn && <StartGame/> }
				{ status === "IN_PROGRESS" && (
					<Fragment>
						{ playerId === currentTurn && <AskCard/> }
						{ playerId === currentTurn && <ClaimBook/> }
						{ playerId === currentTurn && isLastMoveSuccessfulCall && <TransferTurn/> }
						<AskHistory/>
					</Fragment>
				) }
			</div>
		</div>
	);
}