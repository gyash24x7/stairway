"use client";

import { motion } from "framer-motion";

import { GameInfo } from "@/shared/ui/components/game-info.tsx";
import { GameStandings } from "@/shared/ui/components/game-standings.tsx";
import { RPlayerInfoSmall } from "@/shared/ui/components/player-info.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { Board } from "@/games/tictactoe/client/board.tsx";
import { useTicTacToe } from "@/games/tictactoe/client/context.tsx";
import { startGameFn } from "@/games/tictactoe/client/client.ts";
import { StartGame } from "@/shared/ui/components/start-game.tsx";

export function GameView() {
	const { data, addBots, isPending } = useTicTacToe();
	const players = Object.values( data.players );
	const isActive = data.status === "IN_PROGRESS";
	const isCompleted = data.status === "COMPLETED";

	const handleAddBots = () => addBots();

	return (
		<div className={ "flex flex-col gap-3 items-center mb-40 max-w-6xl w-full" }>
			<GameInfo
				code={ data.code }
				name={ "tic-tac-toe" }
				completed={ isCompleted }
			/>

			{ data.status === "CREATED" && (
				<div
					className={ cn(
						"rounded-md bg-background p-8 text-center",
						"w-full flex flex-col gap-2 items-center"
					) }
				>
					<p className={ "text-lg font-heading" }>Waiting for opponent...</p>
					<p className={ "text-sm text-muted-foreground mb-2" }>
						Share the game code to invite a player
					</p>
					<Button onClick={ handleAddBots }>
						{ isPending ? <Spinner/> : "Add Bots" }
					</Button>
				</div>
			) }

			{ data.status === "PLAYERS_READY" && (
				<div
					className={ cn(
						"rounded-md bg-background p-8 text-center",
						"w-full flex flex-col gap-2 items-center"
					) }
				>
					<p className={ "text-lg font-heading" }>Both seats filled</p>
					<StartGame
						gameId={ data.id }
						queryKey={ [ "tic-tac-toe", "getState", data.id ] }
						startGame={ startGameFn }
					/>
				</div>
			) }

			<GameStandings
				results={ data.results }
				players={ data.players }
				playerId={ data.view.playerId }
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
		</div>
	);
}
