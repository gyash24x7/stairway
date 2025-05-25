import { dictionary } from "@/shared/words/dictionary";
import { getGuessBlocks, type LetterState } from "@/shared/words/utils";
import { cn } from "@/shared/utils/cn";
import { store } from "@/wordle/store";
import { useStore } from "@tanstack/react-store";

function getBlockColor( state: LetterState ) {
	switch ( state ) {
		case "correct":
			return "bg-green-500";
		case "empty":
			return "bg-bg";
		case "wrong":
			return "bg-gray-500";
		case "wrongPlace":
			return "bg-amber-500";
	}
}

export function GuessBlocks() {
	const { game, currentGuess } = useStore( store );

	const isValidWord = dictionary.includes( currentGuess.join( "" ) );
	const isValidGuessLength = currentGuess.length === game.wordLength;
	const guessBlockMap = getGuessBlocks( game, currentGuess.join( "" ) );

	const isInvalidGuess = ( word: string, i: number ) => (
		isValidGuessLength && !isValidWord && i === game.guesses.length && !game.completedWords.includes( word )
	);

	return (
		<div className={ "flex justify-center flex-wrap gap-3 mb-48" }>
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
	const game = useStore( store, state => state.game );
	const guessBlockMap = getGuessBlocks( game, "" );

	return (
		<div className={ "flex justify-center flex-wrap gap-5 mb-48" }>
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
