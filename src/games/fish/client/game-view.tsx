"use client";

import { Fragment } from "react";

import { ActivityFeed } from "@/games/fish/client/activity-feed.tsx";
import { AskCard } from "@/games/fish/client/ask-card.tsx";
import { BooksTracker } from "@/games/fish/client/books-tracker.tsx";
import { ClaimBook } from "@/games/fish/client/claim-book.tsx";
import { useFish } from "@/games/fish/client/context.tsx";
import { HandView } from "@/games/fish/client/hand-view.tsx";
import { GameMetrics } from "@/games/fish/client/metrics.tsx";
import { TeamLobby } from "@/games/fish/client/team-lobby.tsx";
import { TeamsView } from "@/games/fish/client/teams-view.tsx";
import { TransferTurn } from "@/games/fish/client/transfer-turn.tsx";
import { canTransferTurn } from "@/games/fish/shared/utils.ts";
import { ActionBar } from "@/swish/client/action-bar.tsx";
import { GameInfo } from "@/swish/client/game-info.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { GameStatusPanel } from "@/swish/client/game-status-panel.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { TurnBanner } from "@/swish/client/turn-banner.tsx";

export function GameView() {
	const { data, isMyTurn, isPending, addBots, startGame, setAutoPlay } = useFish();

	const me = data.view.playerId;
	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const isPlaying = data.status === "IN_PROGRESS";
	const isCompleted = data.status === "COMPLETED";

	const hasCards = data.view.hand.length > 0;
	const canTransfer = canTransferTurn( data.view, me );
	const autoPlaying = data.autoPlay[ me ] ?? false;

	const seated = data.context.players.length;
	const nonBotPlayers = data.context.players.filter( pid => !data.players[ pid ].isBot );

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ data.id }
				code={ data.code }
				name={ "fish" }
				showChat={ nonBotPlayers.length > 1 }
				completed={ isCompleted }
				additionalInfo={
					<Fragment>
						<StatBlock label={ "TYPE" }>{ data.config.type }</StatBlock>
						<StatBlock label={ "TEAMS" }>{ data.config.teams.length }</StatBlock>
					</Fragment>
				}
				deadline={ data.deadline }
			/>

			<GameStandings
				results={ data.results }
				players={ data.players }
				teamNames={ data.context.teamNames }
				playerId={ me }
				scoreLabel={ "BOOKS" }
			/>

			{ isCompleted && <BooksTracker/> }
			{ isCompleted && <GameMetrics/> }

			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<GameStatusPanel
						status={ data.status }
						seated={ seated }
						playerCount={ data.config.playerCount }
						hint={ "Pick a side below, or leave it and be split evenly when the game starts." }
					/>
					<TeamLobby/>
				</div>
			) }

			{ isPlaying && <TeamsView/> }

			<TurnBanner
				status={ data.status }
				players={ data.players }
				currentPlayer={ data.context.currentPlayer }
				isMyTurn={ isMyTurn }
			/>

			{ isPlaying && (
				<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full" }>
					<HandView/>
					<ActivityFeed/>
				</div>
			) }

			{ !isCompleted && (
				<ActionBar>
					{ data.status === "CREATED" && <AddBots addBots={ addBots } disabled={ isPending }/> }
					{ data.status === "PLAYERS_READY" && (
						<StartGame startGame={ startGame } disabled={ isPending }/>
					) }
					{ isPlaying && (
						<AutoPlayToggle
							autoPlaying={ autoPlaying }
							setAutoPlay={ setAutoPlay }
							disabled={ isPending }
						/>
					) }
					{ isPlaying && isMyTurn && !autoPlaying && hasCards && <AskCard/> }
					{ isPlaying && isMyTurn && !autoPlaying && <ClaimBook/> }
					{ isPlaying && isMyTurn && !autoPlaying && canTransfer && <TransferTurn/> }
				</ActionBar>
			) }
		</div>
	);
}
