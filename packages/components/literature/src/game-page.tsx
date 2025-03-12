import { DisplayHand, GameCode } from "@main/components";
import { useGameCode, useGameStatus, useHand, useLastMove } from "@literature/store";
import { ActionPanel } from "./action-panel";
import { DisplayTeams } from "./display-teams";
import { GameCompleted } from "./game-completed";
import { PlayerLobby } from "./player-lobby";

export function GamePage() {
	const status = useGameStatus();
	const lastMove = useLastMove();
	const code = useGameCode();
	const hand = useHand();

	const areTeamsCreated = status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED";

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ areTeamsCreated && <DisplayTeams/> }
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
				{ status === "IN_PROGRESS" && !!lastMove && (
					<div className={ "p-3 border-2 rounded-md" }>
						<p>{ lastMove.description }</p>
					</div>
				) }
				<PlayerLobby withBg withCardCount={ status === "IN_PROGRESS" }/>
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}