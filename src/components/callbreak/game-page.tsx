"use client";

import { ActionPanel } from "@/components/callbreak/action-panel";
import { DisplayScore } from "@/components/callbreak/display-score";
import { PlayerLobby } from "@/components/callbreak/player-lobby";
import { DisplayCard } from "@/components/main/display-card";
import { DisplayHand } from "@/components/main/display-hand";
import { DisplayPlayer } from "@/components/main/display-player";
import { GameCode } from "@/components/main/game-code";
import { getCardFromId } from "@/libs/cards/card";
import { store } from "@/stores/callbreak";
import type { Callbreak } from "@/types/callbreak";
import { cn } from "@/utils/cn";
import { fjalla } from "@/utils/fonts";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";

export function GamePage( props: { data: Callbreak.Store } ) {
	const status = useStore( store, state => state.game.status );
	const code = useStore( store, state => state.game.code );
	const hand = useStore( store, state => state.hand );
	const deal = useStore( store, state => state.currentDeal );
	const round = useStore( store, state => state.currentRound );
	const players = useStore( store, state => state.players );

	const playerOrder = useStore( store, state => state.currentRound?.playerOrder
		?? state.currentDeal?.playerOrder
		?? Object.keys( state.players ) );

	useEffect( () => {
		store.setState( () => props.data );
	}, [] );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ status === "COMPLETED" && (
					<div className={ "border-2 rounded-md bg-green-200" }>
						<p className={ cn( "lg:text-6xl text-4xl text-center p-3", fjalla.className ) }>
							GAME&nbsp;COMPLETED
						</p>
					</div>
				) }
				{ deal?.status !== "IN_PROGRESS" && <PlayerLobby withBg/> }
				<DisplayScore/>
				{ status === "IN_PROGRESS" && deal?.status === "IN_PROGRESS" && !!round && (
					<div className={ "grid gap-3 grid-cols-2 md:grid-cols-4" }>
						{ playerOrder.map( ( playerId, i ) => {
							const cardId = round.cards[ playerId ]!;
							const card = !!cardId ? getCardFromId( cardId ) : undefined;
							return (
								<div
									key={ playerId }
									className={ cn(
										"w-full flex flex-col gap-3 p-3 rounded-md items-center",
										"bg-gradient-to-b from-white to-main border-2",
										round.turnIdx === i && "bg-white"
									) }
								>
									<DisplayPlayer
										{ ...props }
										player={ players[ playerId ] }
										key={ playerId }
										declaration={ deal?.declarations[ playerId ] }
									/>
									{ card &&
										<DisplayCard rank={ card.rank } suit={ card.suit } key={ cardId } focused/> }
								</div>
							);
						} ) }
					</div>
				) }
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}