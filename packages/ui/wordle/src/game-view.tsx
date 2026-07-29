"use client";

import { GameInfo } from "@s2h/ui/components/game-info";
import { cn } from "@s2h/ui/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { Board } from "./board";
import { useWordle } from "./context";
import { Keyboard } from "./keyboard";

export function GameView() {
	const { data } = useWordle();
	const gameInProgress = data.status === "IN_PROGRESS";
	const gameCompleted = data.status === "COMPLETED";

	return (
		<div className={ cn( "flex flex-col gap-3 items-center mb-40 max-w-6xl w-full" ) }>
			<GameInfo
				code={ data.code }
				name={ "Wordle" }
				completed={ gameCompleted }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>GUESSES</p>
						<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
							{ data.view.guesses.length + "/" + data.view.maxGuesses }
						</h2>
					</div>
				}
			/>
			<AnimatePresence>
				{ gameCompleted && (
					<motion.div
						key={ "wordle-banner" }
						initial={ { opacity: 0, scale: 0.7 } }
						animate={ {
							opacity: 1,
							scale: 1,
							transition: { type: "spring", stiffness: 380, damping: 20, delay: 0.3 }
						} }
						exit={ { opacity: 0, scale: 0.7, transition: { duration: 0.2 } } }
						className={ "rounded-md bg-background p-4 text-center w-full border-2 border-black" }
					>
						<p className={ cn(
							"text-xl md:text-2xl font-heading",
							data.view.victory ? "text-green-500" : "text-red-500"
						) }>
							{ data.view.victory ? "You won!" : "Better luck next time!" }
						</p>
					</motion.div>
				) }
			</AnimatePresence>
			<Board/>
			{ gameInProgress && (
				<div
					className={ cn(
						"fixed bottom-0 bg-surface left-0 right-0",
						"rounded-t-xl flex gap-3 p-3 justify-center"
					) }
				>
					<Keyboard/>
				</div>
			) }
		</div>
	);
}
