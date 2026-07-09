"use client";

import { ActionPanel } from "@/callbreak/components/action-panel";
import { useCallbreak } from "@/callbreak/components/context";
import { DealView } from "@/callbreak/components/deal-view";
import { RCardSuit } from "@/shared/components/card";
import { GameInfo } from "@/shared/components/game-info";
import { PlayerLobbyGrid } from "@/shared/components/player-lobby";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@s2h/shared/utils/cn";
import { Fragment } from "react";

export function GameView() {
	const { shared, addBots } = useCallbreak();
	const isPending = addBots.isPending;

	const handleAddBots = () => addBots.mutate( { gameId: shared.id } );

	return (
		<div className={ `flex flex-col gap-3 w-full max-w-6xl mb-20` }>
			<GameInfo
				code={ shared.code }
				name={ "callbreak" }
				completed={ shared.status === "COMPLETED" }
				additionalInfo={
					<Fragment>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>TRUMP</p>
							<RCardSuit suit={ shared.config.trumpSuit } large themed/>
						</div>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>DEAL COUNT</p>
							<h1 className={ "text-2xl md:text-4xl font-heading" }>
								{ shared.config.dealCount }
							</h1>
						</div>
					</Fragment>
				}
			/>
			<div className={ "flex flex-col gap-3" }>
				{ shared.state.activeDeal && <DealView/> }
				{ !shared.state.activeDeal && (
					<PlayerLobbyGrid
						players={ shared.context.players.map( id => shared.players[ id ] ) }
					/>
				) }
				{ shared.status === "CREATED" && (
					<div
						className={ cn(
							"p-2 md:p-3 rounded-md w-full bg-background",
							"flex flex-col gap-2 items-center"
						) }
					>
						<Spinner size={ "xl" }/>
						<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
							WAITING FOR PLAYERS
						</p>
						<Button onClick={ handleAddBots } disabled={ isPending }>
							{ isPending ? <Spinner/> : "ADD BOTS" }
						</Button>
					</div>
				) }
			</div>
			{ shared.status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}
