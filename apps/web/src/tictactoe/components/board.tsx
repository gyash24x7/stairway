"use client";

import { popIn } from "@/shared/animations/variants";
import { cn } from "@s2h/shared/utils/cn";
import { useTicTacToe } from "@/tictactoe/components/context";
import { findWinningLine } from "@/tictactoe/core/utils";
import { AnimatePresence, motion } from "framer-motion";

const CELL_CENTERS = [
	{ x: 16.66, y: 16.66 }, { x: 50, y: 16.66 }, { x: 83.33, y: 16.66 },
	{ x: 16.66, y: 50 }, { x: 50, y: 50 }, { x: 83.33, y: 50 },
	{ x: 16.66, y: 83.33 }, { x: 50, y: 83.33 }, { x: 83.33, y: 83.33 }
];

export function Board() {
	const { shared, player, placeMove, isPending } = useTicTacToe();

	const isMyTurn = shared.context.currentPlayer === player.playerId;
	const gameInProgress = shared.status === "IN_PROGRESS";
	const disabled = !gameInProgress || !isMyTurn || isPending;
	const winningLine = findWinningLine( shared.state.board );

	const handlePlace = ( position: number ) => placeMove( position );

	return (
		<div className={ "relative grid grid-cols-3 gap-2 w-full max-w-xl" }>
			{ shared.state.board.map( ( cell, index ) => (
				<button
					key={ `Cell ${ index }` }
					onClick={ () => handlePlace( index ) }
					disabled={ disabled || cell !== null }
					className={ cn(
						"aspect-square border-2 border-black rounded-base",
						"flex items-center justify-center",
						"text-4xl md:text-6xl font-title transition-colors",
						cell === "X" && "text-accent bg-background",
						cell === "O" && "text-foreground bg-background",
						!cell && !disabled && "hover:bg-accent/20 cursor-pointer",
						!cell && disabled && "cursor-not-allowed",
						disabled && cell && "cursor-default"
					) }
				>
					<AnimatePresence>
						{ cell && (
							<motion.span
								key={ cell }
								variants={ popIn }
								initial={ "initial" }
								animate={ "animate" }
								exit={ "exit" }
								className={ "inline-block" }
							>
								{ cell }
							</motion.span>
						) }
					</AnimatePresence>
				</button>
			) ) }

			{ winningLine && (
				<svg
					className={ "absolute inset-0 pointer-events-none" }
					viewBox={ "0 0 100 100" }
					preserveAspectRatio={ "none" }
				>
					<motion.line
						x1={ CELL_CENTERS[ winningLine[ 0 ] ]!.x }
						y1={ CELL_CENTERS[ winningLine[ 0 ] ]!.y }
						x2={ CELL_CENTERS[ winningLine[ 2 ] ]!.x }
						y2={ CELL_CENTERS[ winningLine[ 2 ] ]!.y }
						stroke={ "var(--accent)" }
						strokeWidth={ 2.5 }
						strokeLinecap={ "round" }
						initial={ { pathLength: 0, opacity: 0 } }
						animate={ { pathLength: 1, opacity: 1 } }
						transition={ { duration: 0.6, delay: 0.2, ease: "easeOut" } }
					/>
				</svg>
			) }
		</div>
	);
}
