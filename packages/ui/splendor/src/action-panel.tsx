import { useStore } from "@tanstack/react-store";
import { PickTokens } from "./pick-tokens.tsx";
import { PlayerInfo } from "./player-info.tsx";
import { StartGame } from "./start-game.tsx";
import { store } from "./store.tsx";

export function ActionPanel() {
	const status = useStore( store, state => state.status );
	const createdBy = useStore( store, state => state.createdBy );
	const playerId = useStore( store, state => state.playerId );

	return (
		<div className={ "w-full max-w-lg md:max-w-xl flex flex-col gap-2" }>
			<PlayerInfo playerId={ playerId }/>
			{ status === "IN_PROGRESS" && <PickTokens/> }
			{ status === "PLAYERS_READY" && playerId === createdBy && (
				<div className={ "w-full flex justify-center" }>
					<StartGame/>
				</div>
			) }
		</div>
	);
}