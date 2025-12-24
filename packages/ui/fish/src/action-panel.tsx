import { cn } from "@s2h-ui/primitives/utils";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";
import { AddBots } from "./add-bots.tsx";
import { AskCard } from "./ask-card.tsx";
import { AskHistory } from "./ask-history.tsx";
import { ClaimBook } from "./claim-book.tsx";
import { CreateTeams } from "./create-teams.tsx";
import { StartGame } from "./start-game.tsx";
import { store } from "./store.tsx";
import { TransferTurn } from "./transfer-turn.tsx";

export function ActionPanel() {
	const status = useStore( store, state => state.status );
	const currentTurn = useStore( store, state => state.currentTurn );
	const createdBy = useStore( store, state => state.createdBy );
	const playerId = useStore( store, state => state.playerId );
	const players = useStore( store, state => state.players );
	const isLastMoveSuccessfulCall = useStore(
		store,
		( { lastMoveType, claimHistory } ) => lastMoveType === "claim" && claimHistory[ 0 ]?.success
	);

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center bg-background"
			) }
		>
			{ status === "IN_PROGRESS" && (
				<div className={ "p-2 md:p-3 border-2 rounded-md w-full bg-surface max-w-lg" }>
					<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
						IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
					</p>
				</div>
			) }
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "CREATED" && playerId === createdBy && <AddBots/> }
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