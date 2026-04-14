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
import { useMemo } from "react";

export function GameView() {
	const { match, isMyTurn } = useFish();

	const hasCards = match.state.data.hand.length > 0;
	const matchInProgress = match.status === "IN_PROGRESS";
	const playersReady = match.status === "PLAYERS_READY";
	const hasTeams = Object.keys( match.state.data.teams ).length > 0;
	const lastClaim = match.state.data.claimHistory[ 0 ];
	const canTransfer = match.state.data.lastMoveType === "claim"
		&& lastClaim?.success
		&& lastClaim.playerId === match.state.data.playerId;

	const winningTeam = useMemo( () => {
		if ( match.result && match.result.victory && "winner" in match.result ) {
			return match.state.data.teams[ match.result.winner ];
		}

		return;
	}, [ match ] );

	return (
		<div className={ `flex flex-col gap-3 items-center max-w-6xl justify-self-center w-full mb-80 lg:mb-0` }>
			<GameInfo
				code={ match.code }
				name={ "fish" }
				completed={ match.status === "COMPLETED" }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>TYPE</p>
						<h1 className={ "text-2xl md:text-4xl font-heading" }>{ match.config.type }</h1>
					</div>
				}
			/>
			{ match.status === "COMPLETED" && match.result && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					{ winningTeam ? (
						<p className={ "text-lg font-heading" }>
							{ winningTeam.members.includes( match.state.data.playerId )
								? `${ winningTeam.name } won!`
								: "You lost!"
							}
						</p>
					) : (
						<p className={ "text-lg font-heading" }>It's a draw!</p>
					) }
				</div>
			) }
			{ match.status === "COMPLETED" && <BooksTracker/> }
			{ match.status === "COMPLETED" && <GameMetrics/> }
			<div className={ "grid grid-cols-1 gap-3 w-full justify-items-center" }>
				{ ( match.status === "CREATED" || playersReady ) && <PlayerLobby/> }
				{ matchInProgress && <TeamsView/> }
				{ matchInProgress && (
					<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full" }>
						<HandView/>
						<ActivityFeed/>
					</div>
				) }
				<div className={ cn( "flex flex-col justify-end gap-3 w-full" ) }>
					{ match.status === "CREATED" && (
						<div
							className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
							<Spinner size={ "xl" }/>
							<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
								WAITING FOR PLAYERS
							</p>
						</div>
					) }
					{ playersReady && !hasTeams && (
						<div
							className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
							<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
								ALL PLAYERS JOINED — CREATE TEAMS TO START
							</p>
						</div>
					) }
					{ matchInProgress && <TurnIndicator/> }
				</div>
			</div>
			<div
				className={ cn(
					"fixed bottom-0 bg-surface",
					"rounded-t-xl flex gap-3 p-3 items-center"
				) }
			>
				{ match.status === "CREATED" && <AddBots/> }
				{ playersReady && !hasTeams && <CreateTeams/> }
				{ matchInProgress && isMyTurn && hasCards && <AskCard/> }
				{ matchInProgress && isMyTurn && <ClaimBook/> }
				{ matchInProgress && isMyTurn && canTransfer && <TransferTurn/> }
			</div>
		</div>
	);
}
