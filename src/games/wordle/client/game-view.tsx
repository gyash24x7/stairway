"use client";

import { Fragment } from "react";

import { OwnBoard } from "@/games/wordle/client/board.tsx";
import { useWordle } from "@/games/wordle/client/context.tsx";
import { DuelScoreboard, RivalBoards } from "@/games/wordle/client/duel-view.tsx";
import { Keyboard } from "@/games/wordle/client/keyboard.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { ActionBar } from "@/swish/client/action-bar.tsx";
import { GameInfo } from "@/swish/client/game-info.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { GameStatusPanel } from "@/swish/client/game-status-panel.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";

export function GameView() {
	const {
		data,
		board,
		forfeit,
		addBots,
		setAutoPlay,
		autoPlaying,
		isPending
	} = useWordle();

	const isDuel = data.config.playerCount > 1;
	const inProgress = data.status === "IN_PROGRESS";
	const isCompleted = data.status === "COMPLETED";
	const canPlay = inProgress && !board.finished;
	const nonBotPlayers = data.context.players.filter( pid => !data.players[ pid ].isBot );

	const seated = data.context.players.length;
	const seatsToFill = data.config.playerCount - seated;

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ data.id }
				code={ data.code }
				name={ "wordle" }
				completed={ isCompleted }
				additionalInfo={
					<Fragment>
						<StatBlock label={ "GUESSES" }>
							{ board.guessCount }/{ data.view.maxGuesses }
						</StatBlock>
						<StatBlock label={ "WORDS" }>
							{ board.solvedWords.filter( Boolean ).length }/{ data.config.wordCount }
						</StatBlock>
					</Fragment>
				}
				deadline={ data.deadline }
				showChat={ nonBotPlayers.length > 1 }
			/>

			<GameStatusPanel
				status={ data.status }
				seated={ seated }
				playerCount={ data.config.playerCount }
				hint={ "Share the game code; the race starts the moment every seat is filled." }
			>
				<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>

				{ seatsToFill > 0 && <AddBots addBots={ addBots } disabled={ isPending }/> }
			</GameStatusPanel>

			<GameStandings
				results={ data.results }
				players={ data.players }
				playerId={ data.view.playerId }
				scoreLabel={ "SCORE" }
			/>

			{ isDuel && inProgress && <DuelScoreboard/> }

			{ data.status !== "CREATED" && <OwnBoard/> }

			{ inProgress && board.finished && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					<p className={ "text-status" }>YOUR BOARD IS DONE</p>
					<p className={ "text-sm text-muted-foreground" }>
						{ isDuel
							? "Waiting for the other players to finish."
							: "Waiting for the game to be scored." }
					</p>
				</div>
			) }

			<RivalBoards/>

			{ canPlay && (
				<ActionBar className={ "py-3" } contentClassName={ "max-w-3xl flex-col" }>
					<Keyboard/>

					<div className={ "flex flex-wrap gap-2 justify-center" }>
						<AutoPlayToggle
							autoPlaying={ autoPlaying }
							setAutoPlay={ setAutoPlay }
							disabled={ isPending }
						/>

						<Button size={ "sm" } variant={ "neutral" } onClick={ forfeit } disabled={ isPending }>
							GIVE UP
						</Button>
					</div>
				</ActionBar>
			) }
		</div>
	);
}
