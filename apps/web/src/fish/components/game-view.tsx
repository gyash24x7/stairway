"use client";

import { ActivityFeed } from "@/fish/components/activity-feed";
import { AddBots } from "@/fish/components/add-bots";
import { AskCard } from "@/fish/components/ask-card";
import { BooksTracker } from "@/fish/components/books-tracker";
import { ClaimBook } from "@/fish/components/claim-book";
import { useFish } from "@/fish/components/context";
import { CreateTeams } from "@/fish/components/create-teams";
import { HandView } from "@/fish/components/hand-view";
import { GameMetrics } from "@/fish/components/metrics";
import { TeamsView } from "@/fish/components/teams-view";
import { TransferTurn } from "@/fish/components/transfer-turn";
import { TurnIndicator } from "@/fish/components/turn-indicator";
import { GameInfo } from "@s2h/ui/components/game-info";
import { PlayerLobbyGrid } from "@s2h/ui/components/player-lobby";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { cn } from "@s2h/shared/utils/cn";

export function GameView() {
	const { shared, player } = useFish();

	const isMyTurn = shared.status === "IN_PROGRESS"
		&& shared.context.currentPlayer === player.playerId;

	const hasCards = player.hand.length > 0;
	const isTeamConfig = shared.status === "IN_PROGRESS" && shared.context.phase === "TEAM_CONFIG";
	const isPlaying = shared.status === "IN_PROGRESS" && shared.context.phase === "PLAY";
	const lastClaim = shared.state.claimHistory[ 0 ];
	const canTransfer = shared.state.lastMoveType === "claim"
		&& lastClaim?.success
		&& lastClaim.playerId === player.playerId;

	return (
		<div className={ `flex flex-col gap-3 items-center max-w-6xl w-full mb-20 lg:mb-0` }>
			<GameInfo
				code={ shared.code }
				name={ "fish" }
				completed={ shared.status === "COMPLETED" }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>TYPE</p>
						<h1 className={ "text-2xl md:text-4xl font-heading" }>
							{ shared.config.type }
						</h1>
					</div>
				}
			/>
			{ shared.status === "COMPLETED" && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					{ shared.state.winningTeam ? (
						<p className={ "text-lg font-heading" }>
							{ shared.state.teams[ shared.state.winningTeam ].members.includes( player.playerId )
								? `${ shared.state.teams[ shared.state.winningTeam ].name } won!`
								: "You lost!"
							}
						</p>
					) : (
						<p className={ "text-lg font-heading" }>It's a draw!</p>
					) }
				</div>
			) }
			{ shared.status === "COMPLETED" && <BooksTracker/> }
			{ shared.status === "COMPLETED" && <GameMetrics/> }
			<div className={ "grid grid-cols-1 gap-3 w-full justify-items-center" }>
				{ ( shared.status === "CREATED" || isTeamConfig ) && (
					<PlayerLobbyGrid players={ shared.context.players.map( id => shared.players[ id ] ) }/>
				) }
				{ isPlaying && <TeamsView/> }
				{ isPlaying && (
					<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full" }>
						<HandView/>
						<ActivityFeed/>
					</div>
				) }
				<div className={ cn( "flex flex-col justify-end gap-3 w-full" ) }>
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
				{ shared.status === "CREATED" && <AddBots/> }
				{ isTeamConfig && <CreateTeams/> }
				{ isPlaying && isMyTurn && hasCards && <AskCard/> }
				{ isPlaying && isMyTurn && <ClaimBook/> }
				{ isPlaying && isMyTurn && canTransfer && <TransferTurn/> }
			</div>
		</div>
	);
}
