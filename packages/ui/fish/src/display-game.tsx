import { DisplayHand } from "@s2h-ui/shared/display-hand";
import { GameCode } from "@s2h-ui/shared/game-code";
import { useStore } from "@tanstack/react-store";
import { ActionPanel } from "./action-panel.tsx";
import { DisplayTeams } from "./display-teams.tsx";
import { GameCompleted } from "./game-completed.tsx";
import { PlayerLobby } from "./player-lobby.tsx";
import { store } from "./store.tsx";

export function DisplayGame() {
	const status = useStore( store, state => state.status );
	const code = useStore( store, state => state.code );
	const hand = useStore( store, state => state.hand );
	const ask = useStore( store, state => state.askHistory[ 0 ] );
	const areTeamsCreated = status === "TEAMS_CREATED" || status === "IN_PROGRESS" || status === "COMPLETED";

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code } name={ "fish" }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ areTeamsCreated && <DisplayTeams/> }
				<PlayerLobby withBg withCardCount={ status === "IN_PROGRESS" }/>
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
				{ status === "IN_PROGRESS" && !!ask && (
					<div className={ "p-3 border-2 rounded-md" } key={ ask.timestamp }>
						<p>{ ask.description }</p>
					</div>
				) }
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}