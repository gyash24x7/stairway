import { cn } from "@/shared/utils/cn";
import { useWordle } from "@/wordle/components/context";
import { getWords } from "@/wordle/core/actions";
import type { GuessResult, GuessResultsForWord, LetterStatus } from "@/wordle/core/types";
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

function GuessTiles( { result, isCurrentRow }: { result: GuessResult[]; isCurrentRow: boolean } ) {
	const { shared, currentGuess, invalidGuess } = useWordle();
	const hasResult = result.some( ( r ) => r.letter !== "" );

	const getCurrentLetter = ( idx: number ) => !hasResult && isCurrentRow
		? currentGuess.charAt( idx )
		: undefined;

	const isCompleted = shared.status === "COMPLETED";

	return (
		<div
			className={ cn(
				"grid gap-1",
				shared.config.wordLength === 4 && "grid-cols-4",
				shared.config.wordLength === 5 && "grid-cols-5",
				shared.config.wordLength === 6 && "grid-cols-6"
			) }
		>
			{ result.map( ( { letter, status }, idx ) => (
				<div
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
				>
					{ !isCompleted && (
						<p className={ "text-lg sm:text-xl md:text-2xl font-semibold" }>
							{ ( hasResult ? letter : getCurrentLetter( idx ) )?.toUpperCase() }
						</p>
					) }
				</div>
			) ) }
		</div>
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
					key={ `word-tiles-${ idx }` }
				/>
			) ) }
		</div>
	);
}

export function Board() {
	const { shared } = useWordle();
	const [ words, setWords ] = useState<string[]>( [] );

	useEffect( () => {
		if ( shared.status === "COMPLETED" ) {
			getWords( { gameId: shared.id } ).then( setWords );
		}
	}, [ shared.id, shared.status ] );

	return (
		<div className={ "flex justify-center flex-wrap gap-3 w-full" }>
			{ shared.state.guessResults.map( ( guessResultsForWord, idx ) => (
				<div key={ `word-${ idx }` } className={ "flex flex-col gap-2 items-center" }>
					<WordTiles results={ guessResultsForWord }/>
					{ !!words[ idx ] && (
						<h1 className={ "font-heading text-xl" }>
							{ words[ idx ].toUpperCase() }
						</h1>
					) }
				</div>
			) ) }
		</div>
	);
}
