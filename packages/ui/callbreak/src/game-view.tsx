"use client";

import { RCardSuit } from "@s2h/ui/components/card";
import { GameInfo } from "@s2h/ui/components/game-info";
import { PlayerLobbyGrid } from "@s2h/ui/components/player-lobby";
import { Button } from "@s2h/ui/primitives/button";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { cn } from "@s2h/ui/utils/cn";
import { Fragment } from "react";
import { ActionPanel } from "./action-panel";
import { useCallbreak } from "./context";
import { DealView } from "./deal-view";

export function GameView() {
	const { data, addBots } = useCallbreak();
	const isPending = addBots.isPending;

	const handleAddBots = () => addBots.mutate( { gameId: data.id } );

	return (
		<div className={ `flex flex-col gap-3 w-full max-w-6xl mb-20` }>
			<GameInfo
				code={ data.code }
				name={ "callbreak" }
				completed={ data.status === "COMPLETED" }
				additionalInfo={
					<Fragment>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>TRUMP</p>
							<RCardSuit suit={ data.config.trumpSuit } large themed/>
						</div>
						<div className={ "py-2 px-4" }>
							<p className={ "text-xs md:text-sm" }>DEAL COUNT</p>
							<h1 className={ "text-2xl md:text-4xl font-heading" }>
								{ data.config.dealCount }
							</h1>
						</div>
					</Fragment>
				}
			/>
			<div className={ "flex flex-col gap-3" }>
				{ data.view.activeDeal && <DealView/> }
				{ !data.view.activeDeal && (
					<PlayerLobbyGrid
						players={ data.context.players.map( id => data.players[ id ] ) }
					/>
				) }
				{ data.status === "CREATED" && (
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
			{ data.status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}
