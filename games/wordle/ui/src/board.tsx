import { orpc } from "@s2h/client/query";
import { cn } from "@s2h/shared/utils/cn";
import { useWordle } from "./context";
import type { GuessResult, GuessResultsForWord, LetterStatus } from "@s2h/wordle-core/types";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

function getBlockColor( status: LetterStatus ) {
	switch ( status ) {
		case "correct":
			return "bg-green-500";
		case "present":
			return "bg-amber-500";
		default:
			return "bg-background";
	}
}

type GuessTilesProps = {
	result: GuessResult[];
	isCurrentRow: boolean;
	rowIndex: number;
};

function GuessTiles( { result, isCurrentRow, rowIndex }: GuessTilesProps ) {
	const { shared, currentGuess, invalidGuess, lastRevealedRow } = useWordle();
	const hasResult = result.some( ( r ) => r.letter !== "" );
	const isRevealing = hasResult && lastRevealedRow === rowIndex;

	const getCurrentLetter = ( idx: number ) => !hasResult && isCurrentRow
		? currentGuess.charAt( idx )
		: undefined;

	const isCompleted = shared.status === "COMPLETED";

	return (
		<motion.div
			className={ cn(
				"grid gap-1",
				shared.config.wordLength === 4 && "grid-cols-4",
				shared.config.wordLength === 5 && "grid-cols-5",
				shared.config.wordLength === 6 && "grid-cols-6"
			) }
			animate={ isCurrentRow && invalidGuess ? { x: [ 0, -8, 8, -8, 8, -4, 4, 0 ] } : { x: 0 } }
			transition={ { duration: 0.5 } }
		>
			{ result.map( ( { letter, status }, idx ) => {
				const displayLetter = ( hasResult ? letter : getCurrentLetter( idx ) )?.toUpperCase();
				return (
					<motion.div
						key={ `guess-tiles-${ idx }` }
						className={ cn(
							"border-inverted-surface",
							hasResult ? getBlockColor( status ) : "bg-background",
							"border rounded flex items-center justify-center",
							isCurrentRow && !!getCurrentLetter( idx ) && "border-foreground",
							isCurrentRow && invalidGuess && "border-red-500",
							!isCompleted && "w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12",
							isCompleted && "w-5 h-5 md:h-8 md:w-8"
						) }
						style={ { perspective: 600 } }
						initial={ false }
						animate={ isRevealing
							? { rotateX: [ 0, 90, 0 ], scale: [ 1, 1, 1 ] }
							: { rotateX: 0 }
						}
						transition={ isRevealing
							? { duration: 0.55, times: [ 0, 0.5, 1 ], delay: idx * 0.12 }
							: { duration: 0 }
						}
					>
						{ !isCompleted && displayLetter && (
							<motion.p
								key={ `${ displayLetter }-${ hasResult ? "r" : "c" }` }
								className={ "text-lg sm:text-xl md:text-2xl font-semibold" }
								initial={ !hasResult ? { scale: 0.6, opacity: 0 } : false }
								animate={ { scale: 1, opacity: 1 } }
								transition={ { type: "spring", stiffness: 500, damping: 20 } }
							>
								{ displayLetter }
							</motion.p>
						) }
					</motion.div>
				);
			} ) }
		</motion.div>
	);
}

function WordTiles( { results }: { results: GuessResultsForWord } ) {
	const { shared } = useWordle();
	const isSolved = results.some(
		( row ) => row.every( ( r ) => r.status === "correct" && r.letter !== "" )
	);

	return (
		<div className="grid gap-1" role="grid">
			{ results.map( ( result, idx ) => (
				<GuessTiles
					result={ result }
					isCurrentRow={ !isSolved && shared.state.guesses.length === idx }
					rowIndex={ idx }
					key={ `word-tiles-${ idx }` }
				/>
			) ) }
		</div>
	);
}

export function Board() {
	const { shared } = useWordle();
	const { data: words = [] } = useQuery( orpc.wordle.getWords.queryOptions( {
		input: { gameId: shared.id },
		enabled: shared.status === "COMPLETED"
	} ) );

	return (
		<div className={ "flex justify-center flex-wrap gap-3 w-full" }>
			{ shared.state.guessResults.map( ( guessResultsForWord, idx ) => (
				<div key={ `word-${ idx }` } className={ "flex flex-col gap-2 items-center" }>
					<WordTiles results={ guessResultsForWord }/>
					{ !!words[ idx ] && (
						<motion.h1
							className={ "font-heading text-xl" }
							initial={ { opacity: 0, scale: 0.7 } }
							animate={ { opacity: 1, scale: 1 } }
							transition={ { type: "spring", stiffness: 380, damping: 22, delay: idx * 0.1 } }
						>
							{ words[ idx ].toUpperCase() }
						</motion.h1>
					) }
				</div>
			) ) }
		</div>
	);
}
