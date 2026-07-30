"use client";

import { AnimatePresence, motion } from "framer-motion";

import { GameInfo } from "@/shared/ui/components/game-info.tsx";
import { RPlayerInfoSmall } from "@/shared/ui/components/player-info.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { popIn, slideInUp } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";
import { Board } from "@/games/tictactoe/client/board.tsx";
import { useTicTacToe } from "@/games/tictactoe/client/context.tsx";

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

			<AnimatePresence>
				{ isCompleted && data.view.winner && (
					<motion.div
						key={ "winner-banner" }
						variants={ slideInUp }
						initial={ "initial" }
						animate={ "animate" }
						exit={ "exit" }
						className={ "rounded-md bg-background p-4 text-center w-full border-2 border-black" }
					>
						{ data.view.winner !== "draw" ? (
							<p className={ "text-lg font-heading" }>
								{ data.view.winner === data.view.playerId ? "You won!" : "You lost!" }
							</p>
						) : (
							<motion.p
								className={ "text-lg font-heading" }
								variants={ popIn }
								initial={ "initial" }
								animate={ "animate" }
							>
								It's a draw!
							</motion.p>
						) }
					</motion.div>
				) }
			</AnimatePresence>

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
