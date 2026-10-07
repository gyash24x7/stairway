import { cn } from "cn";
import { AnimatePresence, motion } from "framer-motion";

import type { Board } from "@/games/tictactoe/schema";
import { popIn } from "@/shared/shell/animation";


const WINNING_LINES = [
	[ 0, 1, 2 ], [ 3, 4, 5 ], [ 6, 7, 8 ], // rows
	[ 0, 3, 6 ], [ 1, 4, 7 ], [ 2, 5, 8 ], // columns
	[ 0, 4, 8 ], [ 2, 4, 6 ] // diagonals
] as const;

const CELL_CENTERS = [
	{ x: 16.66, y: 16.66 }, { x: 50, y: 16.66 }, { x: 83.33, y: 16.66 },
	{ x: 16.66, y: 50 }, { x: 50, y: 50 }, { x: 83.33, y: 50 },
	{ x: 16.66, y: 83.33 }, { x: 50, y: 83.33 }, { x: 83.33, y: 83.33 }
];

const findWinningLine = ( board: Board ) => {
	for ( const line of WINNING_LINES ) {
		const [ a, b, c ] = line;
		if ( board[ a ] && board[ a ] === board[ b ] && board[ a ] === board[ c ] ) {
			return line;
		}
	}
	return null;
};

export type BoardProps = {
	readonly board: Board;
	readonly disabled: boolean;
	readonly onPlace: ( position: number ) => void;
};

export function TicTacToeBoard( { board, disabled, onPlace }: BoardProps ) {
	const winningLine = findWinningLine( board );

	return (
		<div className={ "relative grid grid-cols-3 gap-2 w-full max-w-xl" }>
			{ board.map( ( cell, index ) => (
				<button
					key={ `Cell ${ index }` }
					onClick={ () => onPlace( index ) }
					disabled={ disabled || cell !== null }
					className={ cn(
						"aspect-square border-2 border-outline rounded-base",
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
