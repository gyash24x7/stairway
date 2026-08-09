"use client";

import { Fragment } from "react";

import { ChatPanel } from "@/chat/client/chat-panel.tsx";
import { RCardSuit } from "@/shared/ui/components/card.tsx";
import { GameInfo } from "@/shared/ui/components/game-info.tsx";
import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { PlayerLobbyGrid } from "@/shared/ui/components/player-lobby.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { ActionPanel } from "@/games/callbreak/client/action-panel.tsx";
import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { DealView } from "@/games/callbreak/client/deal-view.tsx";
import { startGameFn } from "@/games/callbreak/client/client.ts";
import { StartGame } from "@/shared/ui/components/start-game.tsx";

export function GameView() {
	const { data, addBots } = useCallbreak();
	const isPending = addBots.isPending;

	const handleAddBots = () => addBots.mutate();

	return (
		<div className={ `flex flex-col gap-3 w-full max-w-6xl mb-20` }>
			<GameInfo
				code={ data.code }
				name={ "callbreak" }
				completed={ data.status === "COMPLETED" }
				actions={ <ChatPanel channelId={ data.id }/> }
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
				<GameStandings
					results={ data.results }
					players={ data.players }
					playerId={ data.view.playerId }
					scoreLabel={ "SCORE" }
				/>
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
				{ data.status === "PLAYERS_READY" && (
					<div
						className={ cn(
							"p-2 md:p-3 rounded-md w-full bg-background",
							"flex flex-col gap-2 items-center"
						) }
					>
						<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
							ALL PLAYERS JOINED
						</p>
						<StartGame
							gameId={ data.id }
							queryKey={ [ "callbreak", "getState", data.id ] }
							startGame={ startGameFn }
						/>
					</div>
				) }
			</div>
			{ data.status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}
