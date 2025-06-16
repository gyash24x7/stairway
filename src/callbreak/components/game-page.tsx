"use client";

import { ActionPanel } from "@/callbreak/components/action-panel";
import { DisplayDeal } from "@/callbreak/components/display-deal";
import { DisplayScore } from "@/callbreak/components/display-score";
import { store } from "@/callbreak/store";
import type { Callbreak } from "@/callbreak/types";
import { DisplayHand } from "@/shared/components/display-hand";
import { GameCode } from "@/shared/components/game-code";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";

export function GamePage( props: { data: Callbreak.Store } ) {
	const status = useStore( store, state => state.game.status );
	const code = useStore( store, state => state.game.code );
	const hand = useStore( store, state => state.hand );

	useEffect( () => {
		store.setState( () => props.data );
	}, [] );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ status === "COMPLETED" && (
					<div className={ "border-2 rounded-md bg-green-200" }>
						<p className={ cn( "lg:text-6xl text-4xl text-center p-3 font-heading" ) }>
							GAME&nbsp;COMPLETED
						</p>
					</div>
				) }
				<DisplayScore/>
				{ status === "IN_PROGRESS" && <DisplayDeal/> }
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}