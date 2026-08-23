"use client";

import { UsersIcon } from "lucide-react";
import { useState } from "react";

import { Board } from "@/games/splendor/client/board.tsx";
import { CardActions } from "@/games/splendor/client/card-actions.tsx";
import { ClaimNoble } from "@/games/splendor/client/claim-noble.tsx";
import { useSplendor } from "@/games/splendor/client/context.tsx";
import { PickTokens } from "@/games/splendor/client/pick-tokens.tsx";
import { PlayerInfo } from "@/games/splendor/client/player-info.tsx";
import { PlayerTableau } from "@/games/splendor/client/player-tableau.tsx";
import { ReservedCardsDrawer } from "@/games/splendor/client/reserved-cards.tsx";
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
import { ActionBar } from "@/swish/client/action-bar.tsx";
import { GameInfo } from "@/swish/client/game-info.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { GameStatusPanel } from "@/swish/client/game-status-panel.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { Rematch } from "@/swish/client/rematch.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { TurnBanner } from "@/swish/client/turn-banner.tsx";

export function GameView() {
	const {
		data,
		playerId,
		isMyTurn,
		mustPass,
		pass,
		addBots,
		startGame,
		setAutoPlay,
		startRematch,
		isPending
	} = useSplendor();

	const [ playersOpen, setPlayersOpen ] = useState( false );

	const isPlaying = data.status === "IN_PROGRESS";
	const isLastRound = isPlaying && Object.values( data.view.playerData )
		.some( p => p.points >= data.config.winningPoints );

	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const autoPlaying = !!playerId && ( data.autoPlay[ playerId ] ?? false );
	const nonBotPlayers = data.context.players.filter( pid => !data.players[ pid ].isBot );

	const otherPlayers = data.context.players.filter( p => p !== playerId );

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ data.id }
				code={ data.code }
				name={ "splendor" }
				completed={ data.status === "COMPLETED" }
				additionalInfo={
					<StatBlock label={ "WINNING POINTS" }>{ data.config.winningPoints }</StatBlock>
				}
				deadline={ data.deadline }
				couchSupport
				showChat={ nonBotPlayers.length > 1 }
			/>
			<GameStandings
				results={ data.results }
				players={ data.players }
				playerId={ playerId }
				scoreLabel={ "POINTS" }
			/>

			<Rematch
				game={ "splendor" }
				completed={ data.status === "COMPLETED" }
				rematch={ data.rematch }
				startRematch={ playerId ? startRematch : undefined }
				humans={ nonBotPlayers.length }
				disabled={ isPending }
			/>
			{ isLobby && (
				<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>
			) }
			{ data.status === "COMPLETED" && (
				<div className={ "grid grid-cols-1 md:grid-cols-2 gap-3 w-full" }>
					{ data.context.players.map( p => <PlayerTableau playerId={ p } key={ p }/> ) }
				</div>
			) }
			<GameStatusPanel
				status={ data.status }
				seated={ data.context.players.length }
				playerCount={ data.config.playerCount }
			>
				{ data.status === "CREATED" && !!playerId && (
					<AddBots addBots={ addBots } disabled={ isPending }/>
				) }
				{ data.status === "PLAYERS_READY" && !!playerId && (
					<StartGame startGame={ startGame } disabled={ isPending }/>
				) }
			</GameStatusPanel>

			<TurnBanner
				status={ data.status }
				players={ data.players }
				currentPlayer={ data.context.currentPlayer }
				isMyTurn={ isMyTurn }
				note={ isLastRound ? "LAST ROUND!" : undefined }
			/>

			{ isPlaying && (
				<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full justify-items-center" }>
					<div className={ "flex flex-col gap-3 w-full max-w-lg md:max-w-xl items-center" }>
						<Board renderCard={ card => <CardActions card={ card }/> }/>
						<PickTokens/>
						<Button
							variant={ "neutral" }
							className={ "w-full flex gap-2 items-center justify-center lg:hidden" }
							onClick={ () => setPlayersOpen( true ) }
						>
							<UsersIcon className={ "w-4 h-4" }/>
							<span>VIEW OTHER PLAYERS</span>
						</Button>
					</div>
					<div className={ "hidden lg:flex flex-col gap-3 w-full max-w-lg md:max-w-xl" }>
						{ data.context.players.map( p => (
							<PlayerInfo
								playerId={ p }
								key={ p }
								reservedSlot={ <ReservedCardsDrawer playerId={ p }/> }
							/>
						) ) }
					</div>
				</div>
			) }
			{ isPlaying && (
				<Drawer open={ playersOpen } onOpenChange={ setPlayersOpen }>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>OTHER PLAYERS</DrawerTitle>
							<DrawerDescription/>
						</DrawerHeader>
						<div className={ "px-4 flex flex-col gap-2 overflow-y-scroll max-h-100" }>
							{ otherPlayers.map( p => (
								<PlayerInfo
									playerId={ p }
									key={ p }
									bg
									reservedSlot={ <ReservedCardsDrawer playerId={ p }/> }
								/>
							) ) }
						</div>
						<DrawerFooter/>
					</DrawerContent>
				</Drawer>
			) }
			{ isPlaying && !!playerId && (
				<ActionBar>
					<div className={ "w-full max-w-lg md:max-w-xl lg:hidden" }>
						<PlayerInfo
							playerId={ playerId }
							reservedSlot={ <ReservedCardsDrawer playerId={ playerId }/> }
						/>
					</div>
					<AutoPlayToggle
						autoPlaying={ autoPlaying }
						setAutoPlay={ setAutoPlay }
						disabled={ isPending }
					/>
					{ mustPass && (
						<Button onClick={ pass } disabled={ isPending }>
							{ isPending ? <Spinner/> : "PASS TURN" }
						</Button>
					) }
				</ActionBar>
			) }
			<ClaimNoble/>
		</div>
	);
}
