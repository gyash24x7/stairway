import { cn } from "@base/components";
import type { LetterState } from "@stairway/words";
import {
	useCompletedWords,
	useGameGuesses,
	useGuessBlockMap,
	useIsValidGuessLength,
	useIsValidWord
} from "@wordle/store";

function getBlockColor( state: LetterState ) {
	switch ( state ) {
		case "correct":
			return "bg-green-500";
		case "empty":
			return "bg-background";
		case "wrong":
			return "bg-gray-500";
		case "wrongPlace":
			return "bg-amber-500";
	}
}

export function GuessBlocks( props: { word: string } ) {
	const isValidWord = useIsValidWord();
	const guessBlockMap = useGuessBlockMap();
	const completedWords = useCompletedWords();
	const isValidGuessLength = useIsValidGuessLength();
	const guesses = useGameGuesses();

	const isInvalidGuess = ( i: number ) => isValidGuessLength &&
		!isValidWord &&
		i === guesses.length &&
		!completedWords.includes( props.word );

	return (
		<div className="grid gap-1" role="grid">
			{ guessBlockMap[ props.word ].map( ( guessBlock, i ) => (
				<div className={ "grid grid-cols-5 gap-1" } key={ i }>
					{ guessBlock.map( ( { letter, state }, index ) => (
						<div
							key={ index }
							className={ cn(
								isInvalidGuess( i ) ? "border-red-500" : "",
								getBlockColor( state ),
								"w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 border-2 rounded",
								"flex items-center justify-center"
							) }
						>
							<p className={ "text-lg sm:text-xl md:text-2xl text-black font-semibold" }>
								{ letter?.toUpperCase() }
							</p>
						</div>
					) ) }
				</div>
			) ) }
		</div>
	);
}

export function GuessDiagramBlocks( props: { word: string } ) {
	const guessBlockMap = useGuessBlockMap();
	return (
		<div className="grid gap-1" role="grid">
			{ guessBlockMap[ props.word ].map( ( guessBlock, i ) => (
				<div className={ "grid grid-cols-5 gap-1" } key={ i }>
					{ guessBlock.map( ( { state }, index ) => (
						<div
							key={ index }
							className={ cn(
								getBlockColor( state ),
								"w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded",
								"flex items-center justify-center"
							) }
						/>
					) ) }
				</div>
			) ) }
		</div>
	);
}
