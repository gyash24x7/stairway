import { cn } from "@/shared/utils/cn";
import { useWordle } from "@/wordle/components/context";
import { getWords } from "@/wordle/core/actions";
import type { LetterStatus } from "@/wordle/core/types";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

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

export function GuessBlocks() {
	const { game, currentGuess } = useWordle();
	const currentGuessLetters = currentGuess.split( "" );
	const currentRow = game.state.guesses.length;

	return (
		<div className={ "flex justify-between flex-wrap gap-3 w-full" }>
			{ game.state.guessResults.map( ( guessResultsForWord, idx ) => {
				const isWordSolved = guessResultsForWord.some(
					( row ) => row.every( ( r ) => r.status === "correct" && r.letter !== "" )
				);

				return (
					<div className="grid gap-1" role="grid" key={ `guessBlock${ idx }` }>
						{ guessResultsForWord.map( ( guessResult, i ) => {
							const isCurrentRow = !isWordSolved && i === currentRow;
							const hasResult = guessResult.some( ( r ) => r.letter !== "" );

							return (
								<div
									className={ cn(
										"grid gap-1",
										game.config.wordLength === 4 && "grid-cols-4",
										game.config.wordLength === 5 && "grid-cols-5",
										game.config.wordLength === 6 && "grid-cols-6"
									) }
									key={ i }
								>
									{ guessResult.map( ( { letter, status }, index ) => {
										const currentLetter = !hasResult && isCurrentRow
											? currentGuessLetters[ index ]
											: undefined;

										return (
											<div
												key={ index }
												className={ cn(
													"border-gray-400",
													hasResult ? getBlockColor( status ) : "bg-background",
													"w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 border rounded",
													"flex items-center justify-center",
													isCurrentRow && currentLetter && "border-foreground"
												) }
											>
												<p className={ "text-lg sm:text-xl md:text-2xl font-semibold" }>
													{ ( hasResult ? letter : currentLetter )?.toUpperCase() }
												</p>
											</div>
										);
									} ) }
								</div>
							);
						} ) }
					</div>
				);
			} ) }
		</div>
	);
}

export function GuessDiagramBlocks() {
	const { game } = useWordle();
	const getWordsFn = useServerFn( getWords );
	const [ words, setWords ] = useState<string[]>( [] );

	useEffect( () => {
		getWordsFn( { data: { gameId: game.id } } ).then( setWords );
	}, [ game.id ] );

	return (
		<div className={ "flex justify-center flex-wrap gap-5" }>
			{ game.state.guessResults.map( ( guessResultsForWord, idx ) => (
				<div className="flex flex-col items-center gap-1" key={ `guessBlock${ idx }` }>
					<div className="grid gap-0.5 text-center" role="grid">
						{ guessResultsForWord.map( ( guessResult, i ) => (
							<div
								className={ cn(
									"grid gap-1",
									game.config.wordLength === 4 && "grid-cols-4",
									game.config.wordLength === 5 && "grid-cols-5",
									game.config.wordLength === 6 && "grid-cols-6"
								) }
								key={ i }
							>
								{ guessResult.map( ( { status }, index ) => (
									<div
										key={ index }
										className={ cn(
											getBlockColor( status ),
											"w-5 h-5 md:h-8 md:w-8 rounded",
											"flex items-center justify-center"
										) }
									/>
								) ) }
							</div>
						) ) }
					</div>
					{ words[ idx ] && (
						<p className={ "text-sm md:text-base font-semibold uppercase tracking-wider" }>
							{ words[ idx ] }
						</p>
					) }
				</div>
			) ) }
		</div>
	);
}
