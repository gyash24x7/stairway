"use client";

import { ChatPanel } from "@/chat/client/chat-panel.tsx";
import { GameInfo } from "@/shared/ui/components/game-info.tsx";
import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { PlayerLobbyGrid } from "@/shared/ui/components/player-lobby.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { ActivityFeed } from "@/games/fish/client/activity-feed.tsx";
import { AddBots } from "@/games/fish/client/add-bots.tsx";
import { AskCard } from "@/games/fish/client/ask-card.tsx";
import { BooksTracker } from "@/games/fish/client/books-tracker.tsx";
import { ClaimBook } from "@/games/fish/client/claim-book.tsx";
import { useFish } from "@/games/fish/client/context.tsx";
import { CreateTeams } from "@/games/fish/client/create-teams.tsx";
import { HandView } from "@/games/fish/client/hand-view.tsx";
import { GameMetrics } from "@/games/fish/client/metrics.tsx";
import { TeamsView } from "@/games/fish/client/teams-view.tsx";
import { TransferTurn } from "@/games/fish/client/transfer-turn.tsx";
import { TurnIndicator } from "@/games/fish/client/turn-indicator.tsx";
import { startGameFn } from "@/games/fish/client/client.ts";
import { StartGame } from "@/shared/ui/components/start-game.tsx";

export function GameView() {
	const { data } = useFish();
	const player = data.view;

	const isMyTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === player.playerId;

	const hasCards = player.hand.length > 0;
	const isTeamConfig = data.status === "IN_PROGRESS" && data.context.phase === "TEAM_CONFIG";
	const isPlaying = data.status === "IN_PROGRESS" && data.context.phase === "PLAY";
	const lastClaim = data.view.claimHistory[ 0 ];
	const canTransfer = data.view.lastMoveType === "claim"
		&& lastClaim?.success
		&& lastClaim.playerId === player.playerId;

	return (
		<div className={ `flex flex-col gap-3 items-center max-w-6xl w-full mb-20 lg:mb-0` }>
			<GameInfo
				code={ data.code }
				name={ "fish" }
				completed={ data.status === "COMPLETED" }
				actions={ <ChatPanel channelId={ data.id }/> }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>TYPE</p>
						<h1 className={ "text-2xl md:text-4xl font-heading" }>
							{ data.config.type }
						</h1>
					</div>
				}
			/>
			<GameStandings
				results={ data.results }
				players={ data.players }
				playerId={ player.playerId }
				scoreLabel={ "BOOKS" }
			/>
			{ data.status === "COMPLETED" && <BooksTracker/> }
			{ data.status === "COMPLETED" && <GameMetrics/> }
			<div className={ "grid grid-cols-1 gap-3 w-full justify-items-center" }>
				{ ( data.status === "CREATED" || isTeamConfig ) && (
					<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>
				) }
				{ isPlaying && <TeamsView/> }
				{ isPlaying && (
					<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full" }>
						<HandView/>
						<ActivityFeed/>
					</div>
				) }
				<div className={ cn( "flex flex-col justify-end gap-3 w-full" ) }>
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
					{ isTeamConfig && (
						<div
							className={ cn(
								"p-2 md:p-3 rounded-md w-full bg-background",
								"flex flex-col gap-2 items-center"
							) }
						>
							<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
								ALL PLAYERS JOINED — CREATE TEAMS TO START
							</p>
						</div>
					) }
					{ isPlaying && <TurnIndicator/> }
				</div>
			</div>
			<div
				className={ cn(
					"fixed bottom-0 bg-surface left-0 right-0",
					"rounded-t-xl flex gap-3 p-3 items-center justify-center"
				) }
			>
				{ data.status === "CREATED" && <AddBots/> }
				{ data.status === "PLAYERS_READY" && (
					<StartGame
						gameId={ data.id }
						queryKey={ [ "fish", "getState", data.id ] }
						startGame={ startGameFn }
					/>
				) }
				{ isTeamConfig && <CreateTeams/> }
				{ isPlaying && isMyTurn && hasCards && <AskCard/> }
				{ isPlaying && isMyTurn && <ClaimBook/> }
				{ isPlaying && isMyTurn && canTransfer && <TransferTurn/> }
			</div>
		</div>
	);
}
