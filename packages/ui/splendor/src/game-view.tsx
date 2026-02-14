import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { GameInfo } from "@s2h-ui/shared/game-info";
import { useStore } from "@tanstack/react-store";
import { ActionPanel } from "./action-panel.tsx";
import { Board } from "./board.tsx";
import { PlayerInfo } from "./player-info.tsx";
import { store } from "./store.tsx";

export function GameView() {
	const status = useStore( store, state => state.status );
	const isLastRound = useStore( store, state => state.isLastRound );
	const code = useStore( store, state => state.code );
	const playerIds = useStore( store, state => state.playerOrder.filter( pid => pid !== state.playerId ) );

	return (
		<div className={ `flex flex-col gap-3 items-center max-w-6xl justify-self-center w-full mb-80 lg:mb-0` }>
			<GameInfo code={ code } name={ "splendor" } completed={ status === "COMPLETED" }/>
			<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full justify-items-center" }>
				<div className={ "w-full max-w-lg md:max-w-xl" }>
					<Board/>
				</div>
				<div className={ cn( "flex flex-col justify-end gap-3 w-full max-w-lg md:max-w-xl" ) }>
					{ status === "CREATED" && (
						<div
							className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
							<Spinner size={ "xl" }/>
							<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
								WAITING FOR PLAYERS
							</p>
						</div>
					) }
					{ playerIds.map( player => <PlayerInfo playerId={ player } key={ player }/> ) }
					{ status === "IN_PROGRESS" && isLastRound && (
						<div className={ "p-2 md:p-3 border-2 rounded-md w-full bg-surface" }>
							<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
								THIS IS THE LAST ROUND!
							</p>
						</div>
					) }
					<div className={ "hidden lg:block" }>
						<ActionPanel/>
					</div>
				</div>
			</div>
			<div
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-surface",
					"rounded-t-xl flex flex-col gap-2 p-3 items-center",
					status === "IN_PROGRESS" && "lg:hidden"
				) }
			>
				<ActionPanel/>
			</div>
		</div>
	);
}