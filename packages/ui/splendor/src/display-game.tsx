import { GameCode } from "@s2h-ui/shared/game-code";
import { useStore } from "@tanstack/react-store";
import { ActionPanel } from "./action-panel.tsx";
import { DisplayBoard } from "./display-board.tsx";
import { DisplayTokens } from "./display-tokens.tsx";
import { GameCompleted } from "./game-completed.tsx";
import { PlayerLobby } from "./player-lobby.tsx";
import { store } from "./store.tsx";

export function DisplayGame() {
	const status = useStore( store, state => state.status );
	const code = useStore( store, state => state.code );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code } name={ "splendor" }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				<div className={ "flex gap-3" }>
					<DisplayBoard/>
					<DisplayTokens/>
					<PlayerLobby/>
				</div>
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}