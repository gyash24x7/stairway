import { cn } from "@base/components";
import { useCurrentGuess, useGame, useIsValidGuessLength, useIsValidWord } from "@wordle/store";
import { getGuessBlocks, type LetterState } from "@stairway/words";

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

export function GuessBlocks() {
	const game = useGame();
	const isValidWord = useIsValidWord();
	const currentGuess = useCurrentGuess();
	const isValidGuessLength = useIsValidGuessLength();

	const guessBlockMap = getGuessBlocks( game, currentGuess.join( "" ) );

	const isInvalidGuess = ( word: string, i: number ) => (
		isValidGuessLength && !isValidWord && i === game.guesses.length && !game.completedWords.includes( word )
	);

	return (
		<div className={ "grid grid-cols-2 lg:grid-cols-4 gap-5 mb-48" }>
			{ game.words.map( word => (
				<div className="grid gap-1" role="grid" key={ word }>
					{ guessBlockMap[ word ].map( ( guessBlock, i ) => (
						<div className={ "grid grid-cols-5 gap-1" } key={ i }>
							{ guessBlock.map( ( { letter, state }, index ) => (
								<div
									key={ index }
									className={ cn(
										isInvalidGuess( word, i ) ? "border-red-500" : "",
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
			) ) }
		</div>
	);
}

export function GuessDiagramBlocks() {
	const game = useGame();
	const guessBlockMap = getGuessBlocks( game, "" );

	return (
		<div className={ "grid grid-cols-2 lg:grid-cols-4 gap-5 mb-48" }>
			{ game.words.map( word => (
				<div className="grid gap-1 text-center" role="grid" key={ word }>
					{ guessBlockMap[ word ].map( ( guessBlock, i ) => (
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
					<h2 className={ "font-semibold text-lg" }>{ word.toUpperCase() }</h2>
				</div>
			) ) }
		</div>
	);
}
