import { cn } from "@base/components";
import type { LetterState, PositionData } from "@stairway/words";
import { useGameGuesses, useIsValidGuessLength, useIsValidWord } from "@wordle/store";

function getBlockColor( state: LetterState ) {
	switch ( state ) {
		case "correct":
			return "bg-green-500";
		case "empty":
			return "bg-white";
		case "wrong":
			return "bg-gray-500";
		case "wrongPlace":
			return "bg-amber-500";
	}
}

export function GuessBlocks( props: { guessBlocks: PositionData[][] } ) {
	const isValidWord = useIsValidWord();
	const isValidGuessLength = useIsValidGuessLength();
	const guesses = useGameGuesses();

	return props.guessBlocks.map( ( guessBlock, i ) => (
		<div className={ "flex gap-3" } key={ i }>
			{ guessBlock.map( ( { letter, state }, index ) => (
				<div
					key={ index }
					className={ cn(
						isValidGuessLength && !isValidWord && i === guesses.length ? "border-red" : "",
						getBlockColor( state ),
						"w-12 h-12 border-2 rounded-sm flex items-center justify-center"
					) }
				>
					<p className={ "text-2xl text-black font-bold" }>{ letter?.toUpperCase() }</p>
				</div>
			) ) }
		</div>
	) );
}

export function GuessDiagramBlocks( props: { guessBlocks: PositionData[][] } ) {
	return props.guessBlocks.map( ( guessBlock, i ) => (
		<div className={ "flex gap-3" } key={ i }>
			{ guessBlock.map( ( { state }, index ) => (
				<div
					key={ index }
					className={ cn(
						getBlockColor( state ),
						"w-8 h-8 border-1 rounded-sm flex items-center justify-center"
					) }
				/>
			) ) }
		</div>
	) );
}
