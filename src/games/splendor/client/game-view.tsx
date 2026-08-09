"use client";

import { UsersIcon } from "lucide-react";
import { useState } from "react";

import { ChatPanel } from "@/chat/client/chat-panel.tsx";
import { GameInfo } from "@/shared/ui/components/game-info.tsx";
import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { PlayerLobbyGrid } from "@/shared/ui/components/player-lobby.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { Board } from "@/games/splendor/client/board.tsx";
import { useSplendor } from "@/games/splendor/client/context.tsx";
import { PickTokens } from "@/games/splendor/client/pick-tokens.tsx";
import { PlayerInfo } from "@/games/splendor/client/player-info.tsx";
import { PlayerTableau } from "@/games/splendor/client/player-tableau.tsx";
import { startGameFn } from "@/games/splendor/client/client.ts";
import { StartGame } from "@/shared/ui/components/start-game.tsx";

export function GameView() {
	const { data } = useSplendor();
	const [ playersOpen, setPlayersOpen ] = useState( false );

	const isLastRound = data.status === "IN_PROGRESS" && Object.values( data.view.playerData )
		.some( p => p.points >= data.config.winningPoints );

	// The avatar grid is a "who is here yet" affordance, so it belongs to the two
	// pre-game states only — once the game is over the standings name everyone and
	// each tableau carries its own player strip.
	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";

	const otherPlayers = data.context.players.filter( p => p !== data.view.playerId );

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full mb-80 lg:mb-0" }>
			<GameInfo
				code={ data.code }
				name={ "splendor" }
				completed={ data.status === "COMPLETED" }
				actions={ <ChatPanel channelId={ data.id }/> }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>WINNING POINTS</p>
						<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
							{ data.config.winningPoints }
						</h2>
					</div>
				}
			/>
			<GameStandings
				results={ data.results }
				players={ data.players }
				playerId={ data.view.playerId }
				scoreLabel={ "POINTS" }
			/>
			{ isLobby && (
				<PlayerLobbyGrid
					players={ data.context.players.map( id => data.players[ id ] ) }
				/>
			) }
			{ data.status === "COMPLETED" && (
				<div className={ "grid grid-cols-1 md:grid-cols-2 gap-3 w-full" }>
					{ data.context.players.map( p => <PlayerTableau playerId={ p } key={ p }/> ) }
				</div>
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
						queryKey={ [ "splendor", "getState", data.id ] }
						startGame={ startGameFn }
					/>
				</div>
			) }
			{ data.status === "IN_PROGRESS" && (
				<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full justify-items-center" }>
					<div className={ "flex flex-col gap-3 w-full max-w-lg md:max-w-xl items-center" }>
						<Board/>
						<PickTokens/>
						<Button
							className={ "w-full flex gap-2 items-center justify-center lg:hidden" }
							onClick={ () => setPlayersOpen( true ) }
						>
							<UsersIcon className={ "w-4 h-4" }/>
							<span>VIEW OTHER PLAYERS</span>
						</Button>
						{ isLastRound && (
							<div className={ "p-2 md:p-3 border-2 rounded-md w-full bg-surface" }>
								<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
									THIS IS THE LAST ROUND!
								</p>
							</div>
						) }
					</div>
					<div className={ "hidden lg:flex flex-col gap-3 w-full max-w-lg md:max-w-xl" }>
						{ data.context.players.map( p => <PlayerInfo playerId={ p } key={ p }/> ) }
					</div>
				</div>
			) }
			{ data.status === "IN_PROGRESS" && (
				<Drawer open={ playersOpen } onOpenChange={ setPlayersOpen }>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>OTHER PLAYERS</DrawerTitle>
							<DrawerDescription/>
						</DrawerHeader>
						<div className={ "px-4 flex flex-col gap-2 overflow-y-auto" }>
							{ otherPlayers.map( p => <PlayerInfo playerId={ p } key={ p } bg/> ) }
						</div>
						<DrawerFooter/>
					</DrawerContent>
				</Drawer>
			) }
			{ data.status === "IN_PROGRESS" && (
				<div
					className={ cn(
						"fixed left-0 right-0 bottom-0 bg-surface lg:hidden",
						"rounded-t-xl flex flex-col gap-2 p-3 items-center"
					) }
				>
					<div className={ "w-full max-w-lg md:max-w-xl" }>
						<PlayerInfo playerId={ data.view.playerId }/>
					</div>
				</div>
			) }
		</div>
	);
}
