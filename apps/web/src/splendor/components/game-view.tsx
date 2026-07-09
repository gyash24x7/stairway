"use client";

import { GameInfo } from "@/shared/components/game-info";
import { PlayerLobbyGrid } from "@/shared/components/player-lobby";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@s2h/shared/utils/cn";
import { Board } from "@/splendor/components/board";
import { useSplendor } from "@/splendor/components/context";
import { PickTokens } from "@/splendor/components/pick-tokens";
import { PlayerInfo } from "@/splendor/components/player-info";
import { UsersIcon } from "lucide-react";
import { useState } from "react";

export function GameView() {
	const { shared, player } = useSplendor();
	const [ playersOpen, setPlayersOpen ] = useState( false );

	const isLastRound = shared.status === "IN_PROGRESS" && Object.values( shared.state.playerData )
		.some( p => p.points >= shared.config.winningPoints );

	const otherPlayers = shared.context.players.filter( p => p !== player.playerId );

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full mb-80 lg:mb-0" }>
			<GameInfo
				code={ shared.code }
				name={ "splendor" }
				completed={ shared.status === "COMPLETED" }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>WINNING POINTS</p>
						<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
							{ shared.config.winningPoints }
						</h2>
					</div>
				}
			/>
			{ shared.status === "COMPLETED" && shared.state.winner && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					<p className={ "text-lg font-heading" }>
						{ shared.state.winner === player.playerId ? "You won!" : "You lost!" }
					</p>
				</div>
			) }
			{ shared.status !== "IN_PROGRESS" && (
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
				</div>
			) }
			{ shared.status === "IN_PROGRESS" && (
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
						{ shared.context.players.map( p => <PlayerInfo playerId={ p } key={ p }/> ) }
					</div>
				</div>
			) }
			{ shared.status === "IN_PROGRESS" && (
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
			{ shared.status === "IN_PROGRESS" && (
				<div
					className={ cn(
						"fixed left-0 right-0 bottom-0 bg-surface lg:hidden",
						"rounded-t-xl flex flex-col gap-2 p-3 items-center"
					) }
				>
					<div className={ "w-full max-w-lg md:max-w-xl" }>
						<PlayerInfo playerId={ player.playerId }/>
					</div>
				</div>
			) }
		</div>
	);
}
