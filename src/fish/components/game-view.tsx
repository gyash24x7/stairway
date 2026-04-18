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
import { PlayerLobby } from "@/fish/components/player-lobby";
import { TeamsView } from "@/fish/components/teams-view";
import { TransferTurn } from "@/fish/components/transfer-turn";
import { TurnIndicator } from "@/fish/components/turn-indicator";
import { GameInfo } from "@/shared/components/game-info";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";

export function GameView() {
	const { game, isMyTurn } = useFish();

	const hasCards = game.state.hand.length > 0;
	const isTeamConfig = game.status === "IN_PROGRESS" && game.context.phase === "TEAM_CONFIG";
	const isPlaying = game.status === "IN_PROGRESS" && game.context.phase === "PLAY";
	const lastClaim = game.state.claimHistory[ 0 ];
	const canTransfer = game.state.lastMoveType === "claim"
		&& lastClaim?.success
		&& lastClaim.playerId === game.state.playerId;

	return (
		<div className={ `flex flex-col gap-3 items-center max-w-6xl justify-self-center w-full mb-80 lg:mb-0` }>
			<GameInfo
				code={ game.code }
				name={ "fish" }
				completed={ game.status === "COMPLETED" }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>TYPE</p>
						<h1 className={ "text-2xl md:text-4xl font-heading" }>{ game.config.type }</h1>
					</div>
				}
			/>
			{ game.status === "COMPLETED" && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					{ game.state.winningTeam ? (
						<p className={ "text-lg font-heading" }>
							{ game.state.teams[ game.state.winningTeam ].members.includes( game.state.playerId )
								? `${ game.state.teams[ game.state.winningTeam ].name } won!`
								: "You lost!"
							}
						</p>
					) : (
						<p className={ "text-lg font-heading" }>It's a draw!</p>
					) }
				</div>
			) }
			{ game.status === "COMPLETED" && <BooksTracker/> }
			{ game.status === "COMPLETED" && <GameMetrics/> }
			<div className={ "grid grid-cols-1 gap-3 w-full justify-items-center" }>
				{ ( game.status === "CREATED" || isTeamConfig ) && <PlayerLobby/> }
				{ isPlaying && <TeamsView/> }
				{ isPlaying && (
					<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full" }>
						<HandView/>
						<ActivityFeed/>
					</div>
				) }
				<div className={ cn( "flex flex-col justify-end gap-3 w-full" ) }>
					{ game.status === "CREATED" && (
						<div
							className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
							<Spinner size={ "xl" }/>
							<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
								WAITING FOR PLAYERS
							</p>
						</div>
					) }
					{ isTeamConfig && (
						<div
							className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
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
					"fixed bottom-0 bg-surface",
					"rounded-t-xl flex gap-3 p-3 items-center"
				) }
			>
				{ game.status === "CREATED" && <AddBots/> }
				{ isTeamConfig && <CreateTeams/> }
				{ isPlaying && isMyTurn && hasCards && <AskCard/> }
				{ isPlaying && isMyTurn && <ClaimBook/> }
				{ isPlaying && isMyTurn && canTransfer && <TransferTurn/> }
			</div>
		</div>
	);
}
