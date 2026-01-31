import { Spinner } from "@s2h-ui/primitives/spinner";
import { DisplayCardSuit } from "@s2h-ui/shared/display-card";
import { DisplayPlayer } from "@s2h-ui/shared/display-player";
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
	const players = useStore( store, state => state.players );

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
			<div className={ "flex flex-col gap-3 mb-52" }>
				{ status === "GAME_COMPLETED" && <Scores/> }
				{ currentDeal && <DealView/> }
				{ !currentDeal && (
					<div className={ "flex gap-3" }>
						{ Object.values( players ).map( player => (
							<div key={ player.id } className={ "min-w-1/4" }>
								<DisplayPlayer player={ player }/>
							</div>
						) ) }
					</div>
				) }
				{ status === "GAME_CREATED" && (
					<div className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
						<Spinner size={ "xl" }/>
						<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
							WAITING FOR PLAYERS
						</p>
					</div>
				) }
			</div>
			{ status !== "GAME_COMPLETED" && <ActionPanel/> }
		</div>
	);
}