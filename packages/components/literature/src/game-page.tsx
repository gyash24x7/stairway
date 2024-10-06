import { useGameCode, useGameStatus, useHand, useLastMove } from "@literature/store";
import { DisplayHand, GameCode } from "@main/components";
import { CardHand } from "@stairway/cards";
import { useMemo } from "react";
import { ActionPanel } from "./action-panel.tsx";
import { DisplayTeams } from "./display-teams.tsx";
import { GameCompleted } from "./game-completed.tsx";
import { PlayerLobby } from "./player-lobby.tsx";

export function GamePage() {
	const status = useGameStatus();
	const lastMove = useLastMove();
	const code = useGameCode();
	const hand = useHand();

	const areTeamsCreated = useMemo(
		() => status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED",
		[ status ]
	);

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ areTeamsCreated && <DisplayTeams/> }
				{ status === "IN_PROGRESS" && <DisplayHand hand={ CardHand.from( hand.serialize() ) }/> }
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