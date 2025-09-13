"use client";

import { ActionPanel } from "@/app/components/callbreak/action-panel";
import { DisplayDeal } from "@/app/components/callbreak/display-deal";
import { DisplayScore } from "@/app/components/callbreak/display-score";
import { store } from "@/app/components/callbreak/store";
import { DisplayHand } from "@/app/components/shared/display-hand";
import { GameCode } from "@/app/components/shared/game-code";
import { cn } from "@/utils/cn";
import { useStore } from "@tanstack/react-store";

export function DisplayGame() {
	const status = useStore( store, state => state.status );
	const code = useStore( store, state => state.code );
	const hand = useStore( store, state => state.hand );
	const currentDeal = useStore( store, state => state.currentDeal );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code } name={ "callbreak" }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ status === "GAME_COMPLETED" && (
					<div className={ "border-2 rounded-md bg-green-200" }>
						<p className={ cn( "lg:text-6xl text-4xl text-center p-3 font-heading" ) }>
							GAME&nbsp;COMPLETED
						</p>
					</div>
				) }
				<DisplayScore/>
				{ !!currentDeal && <DisplayDeal/> }
				{ status === "CARDS_DEALT" && <DisplayHand hand={ hand }/> }
			</div>
			{ status !== "GAME_COMPLETED" && <ActionPanel/> }
		</div>
	);
}