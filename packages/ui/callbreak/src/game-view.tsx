import { DisplayCardSuit } from "@s2h-ui/shared/display-card";
import { GameInfo } from "@s2h-ui/shared/game-info";
import { useStore } from "@tanstack/react-store";
import { ActionPanel } from "./action-panel.tsx";
import { DealView } from "./deal-view.tsx";
import { Scores } from "./scores.tsx";
import { store } from "./store.tsx";

export function GameView() {
	const trump = useStore( store, state => state.trump );
	const status = useStore( store, state => state.status );
	const code = useStore( store, state => state.code );
	const currentDeal = useStore( store, state => state.currentDeal );

	return (
		<div className={ `flex flex-col gap-3 w-full max-w-6xl justify-self-center` }>
			<GameInfo
				code={ code }
				name={ "callbreak" }
				completed={ status === "GAME_COMPLETED" }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>TRUMP</p>
						<DisplayCardSuit suit={ trump } large themed/>
					</div>
				}
			/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ status === "GAME_COMPLETED" && <Scores/> }
				{ currentDeal && <DealView/> }
			</div>
			{ status !== "GAME_COMPLETED" && <ActionPanel/> }
		</div>
	);
}