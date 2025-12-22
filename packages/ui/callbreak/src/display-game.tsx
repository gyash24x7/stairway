import { cn } from "@s2h-ui/primitives/utils";
import { DisplayCardSuit } from "@s2h-ui/shared/display-card";
import { DisplayPlayer } from "@s2h-ui/shared/display-player";
import { GameCode } from "@s2h-ui/shared/game-code";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";
import { ActionPanel } from "./action-panel.tsx";
import { DisplayRound } from "./display-round.tsx";
import { DisplayScore } from "./display-score.tsx";
import { NewPlayCard } from "./new-play-card.tsx";
import { store } from "./store.tsx";

export function DisplayGame() {
	const trump = useStore( store, state => state.trump );
	const currentTurn = useStore( store, state => state.currentTurn );
	const status = useStore( store, state => state.status );
	const code = useStore( store, state => state.code );
	const currentDeal = useStore( store, state => state.currentDeal );
	const currentRound = useStore( store, state => state.currentRound! );
	const players = useStore( store, state => state.players );
	const playerOrder = useStore( store, state => state.currentRound?.playerOrder
		?? state.currentDeal?.playerOrder
		?? Object.keys( state.players ) );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code } name={ "callbreak" }>
				<div className={ "py-2 px-4" }>
					<p className={ "text-xs md:text-sm" }>TRUMP</p>
					<DisplayCardSuit suit={ trump } large/>
				</div>
			</GameCode>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ status === "GAME_COMPLETED" && (
					<Fragment>
						<div className={ "border-2 rounded-md bg-green-200" }>
							<p className={ cn( "lg:text-6xl text-4xl text-center p-3 font-heading" ) }>
								GAME&nbsp;COMPLETED
							</p>
						</div>
						<DisplayScore/>
					</Fragment>
				) }
				{ currentDeal?.status === "IN_PROGRESS"
					? (
						<div
							className={ cn(
								"grid grid-cols-1 lg:grid-cols-2 gap-3",
								!currentRound && "lg:grid-cols-1"
							) }
						>
							<DisplayScore/>
							{ currentRound && (
								<DisplayRound round={ currentRound } players={ players } playerOrder={ playerOrder }/>
							) }
						</div>
					) : (
						<div className={ "grid gap-3 grid-cols-4" }>
							{ playerOrder.map( ( playerId ) => (
								<div
									key={ playerId }
									className={ cn(
										"w-full flex flex-col gap-3 rounded-md items-center border-2",
										currentTurn === playerId && "border-main border-4"
									) }
								>
									<DisplayPlayer
										player={ players[ playerId ] }
										key={ playerId }
										withDeclaration={ currentDeal?.status !== "COMPLETED" }
										declaration={ currentDeal?.declarations[ playerId ] }
									/>
								</div>
							) ) }
						</div>
					) }
				{ currentDeal && <NewPlayCard/> }
			</div>
			{ status !== "GAME_COMPLETED" && <ActionPanel/> }
		</div>
	);
}