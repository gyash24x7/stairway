import { cn } from "@base/components";
import {
	useCurrentTurn,
	useGameId,
	useGameStatus,
	useIsLastMoveSuccessfulCall,
	usePlayerId,
	usePlayers
} from "@literature/store";
import { Fragment } from "react";
import { AskCardDialog } from "./ask-card-dialog";
import { CallSetDialog } from "./call-set-dialog";
import { CreateTeamsDialog } from "./create-teams-dialog";
import { AddBots, ExecuteBotMove, StartGame } from "./game-actions";
import { PreviousAsks } from "./previous-asks";
import { TransferTurnDialog } from "./transfer-turn-dialog";

export function ActionPanel() {
	const status = useGameStatus();
	const currentTurn = useCurrentTurn();
	const playerId = usePlayerId();
	const players = usePlayers();
	const gameId = useGameId();
	const isLastMoveSuccessfulCall = useIsLastMoveSuccessfulCall();

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			{ status === "IN_PROGRESS" && (
				<div className={ "p-3 border-2 rounded-md w-full bg-background max-w-lg" }>
					<p className={ "text-xl font-semibold" }>
						IT'S { players[ currentTurn ].name.toUpperCase() }'S TURN!
					</p>
				</div>
			) }
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ status === "CREATED" && playerId === currentTurn && <AddBots gameId={ gameId }/> }
				{ status === "PLAYERS_READY" && playerId === currentTurn && <CreateTeamsDialog/> }
				{ status === "TEAMS_CREATED" && playerId === currentTurn && <StartGame gameId={ gameId }/> }
				{ status === "IN_PROGRESS" && (
					<Fragment>
						{ playerId === currentTurn && <AskCardDialog/> }
						{ playerId === currentTurn && <CallSetDialog/> }
						{ playerId === currentTurn && isLastMoveSuccessfulCall && <TransferTurnDialog/> }
						{ players[ currentTurn ].isBot && <ExecuteBotMove gameId={ gameId }/> }
						<PreviousAsks/>
					</Fragment>
				) }
			</div>
		</div>
	);
}