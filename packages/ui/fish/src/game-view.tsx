"use client";

import { GameInfo } from "@s2h/ui/components/game-info";
import { PlayerLobbyGrid } from "@s2h/ui/components/player-lobby";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { cn } from "@s2h/ui/utils/cn";
import { ActivityFeed } from "./activity-feed";
import { AddBots } from "./add-bots";
import { AskCard } from "./ask-card";
import { BooksTracker } from "./books-tracker";
import { ClaimBook } from "./claim-book";
import { useFish } from "./context";
import { CreateTeams } from "./create-teams";
import { HandView } from "./hand-view";
import { GameMetrics } from "./metrics";
import { TeamsView } from "./teams-view";
import { TransferTurn } from "./transfer-turn";
import { TurnIndicator } from "./turn-indicator";

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
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>TYPE</p>
						<h1 className={ "text-2xl md:text-4xl font-heading" }>
							{ data.config.type }
						</h1>
					</div>
				}
			/>
			{ data.status === "COMPLETED" && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					{ data.view.winningTeam ? (
						<p className={ "text-lg font-heading" }>
							{ data.view.teams[ data.view.winningTeam ].members.includes( player.playerId )
								? `${ data.view.teams[ data.view.winningTeam ].name } won!`
								: "You lost!"
							}
						</p>
					) : (
						<p className={ "text-lg font-heading" }>It's a draw!</p>
					) }
				</div>
			) }
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
				{ isTeamConfig && <CreateTeams/> }
				{ isPlaying && isMyTurn && hasCards && <AskCard/> }
				{ isPlaying && isMyTurn && <ClaimBook/> }
				{ isPlaying && isMyTurn && canTransfer && <TransferTurn/> }
			</div>
		</div>
	);
}
