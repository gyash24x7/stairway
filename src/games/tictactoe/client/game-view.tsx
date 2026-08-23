"use client";

import { motion } from "framer-motion";

import { Board } from "@/games/tictactoe/client/board.tsx";
import { useTicTacToe } from "@/games/tictactoe/client/context.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { ActionBar } from "@/swish/client/action-bar.tsx";
import { GameInfo } from "@/swish/client/game-info.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { GameStatusPanel } from "@/swish/client/game-status-panel.tsx";
import { RPlayerInfoSmall } from "@/swish/client/player-info.tsx";
import { Rematch } from "@/swish/client/rematch.tsx";
import { AddBots } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";
import { TurnBanner } from "@/swish/client/turn-banner.tsx";

export function GameView() {
	const { data, addBots, startGame, startRematch, isPending } = useTicTacToe();
	const players = Object.values( data.players );
	const isActive = data.status === "IN_PROGRESS";
	const isCompleted = data.status === "COMPLETED";
	const isMyTurn = data.context.currentPlayer === data.view.playerId;
	const nonBotPlayers = data.context.players.filter( pid => !data.players[ pid ].isBot );

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ data.id }
				code={ data.code }
				name={ "tictactoe" }
				showChat={ nonBotPlayers.length > 1 }
				completed={ isCompleted }
				deadline={ data.deadline }
			/>

			<GameStatusPanel
				status={ data.status }
				seated={ data.context.players.length }
				playerCount={ data.config.playerCount }
				hint={ "Share the game code to invite a player." }
			/>

			<GameStandings
				results={ data.results }
				players={ data.players }
				playerId={ data.view.playerId }
			/>

			<Rematch
				game={ "tictactoe" }
				completed={ isCompleted }
				rematch={ data.rematch }
				startRematch={ startRematch }
				humans={ nonBotPlayers.length }
				disabled={ isPending }
			/>

			<TurnBanner
				status={ data.status }
				players={ data.players }
				currentPlayer={ data.context.currentPlayer }
				isMyTurn={ isMyTurn }
			/>

			<Board/>

			{ players.length > 0 && (
				<div
					className={ cn(
						"flex justify-around border-2 rounded-md bg-background w-full max-w-xl"
					) }
				>
					{ players.map( ( p, index ) => {
						const isCurrent = data.context.currentPlayer === p.id && isActive;
						return (
							<div
								key={ p.id }
								className={ "relative flex items-center gap-2 p-2 rounded-base" }
							>
								<span className={ "text-2xl font-title" }>
									{ index === 0 ? "X" : "O" }
								</span>
								<RPlayerInfoSmall player={ p }/>
								{ isCurrent && (
									<motion.span
										className={ "text-xs text-accent" }
										animate={ { opacity: [ 0.4, 1, 0.4 ], scale: [ 1, 1.3, 1 ] } }
										transition={ { duration: 1.4, repeat: Infinity, ease: "easeInOut" } }
									>
										●
									</motion.span>
								) }
							</div>
						);
					} ) }
				</div>
			) }

			{ /* Only a lobby has a control here — tictactoe's moves are the board
			     itself, so an in-progress table gets no bar and no space reserved. */ }
			{ data.status === "CREATED" && (
				<ActionBar>
					<AddBots addBots={ addBots } disabled={ isPending }/>
				</ActionBar>
			) }
			{ data.status === "PLAYERS_READY" && (
				<ActionBar>
					<StartGame startGame={ startGame } disabled={ isPending }/>
				</ActionBar>
			) }
		</div>
	);
}
