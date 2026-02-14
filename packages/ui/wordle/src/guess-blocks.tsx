import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { useGetWordsQuery } from "@s2h/client/wordle";
import { dictionaries } from "@s2h/wordle/dictionary";
import { useStore } from "@tanstack/react-store";
import { store } from "./store.tsx";

function getBlockColor( state: string ) {
	switch ( state ) {
		case "correct":
			return "bg-green-500";
		case "empty":
			return "bg-background";
		case "wrong":
			return "bg-gray-500";
		case "wrongPlace":
			return "bg-amber-500";
		default:
			return "bg-background";
	}
}

export function GuessBlocks() {
	const game = useStore( store, state => state.game );
	const currentGuess = useStore( store, state => state.currentGuess );
	const guessBlocks = useStore( store, state => state.game.guessBlocks );

	const isValidWord = dictionaries[ game.wordLength ].includes( currentGuess.join( "" ) );
	const isValidGuessLength = currentGuess.length === game.wordLength;

	const isInvalidGuess = ( i: number ) => (
		isValidGuessLength &&
		!isValidWord &&
		i === game.guesses.length &&
		!game.completedWords.includes( currentGuess.join( "" ) )
	);

	return (
		<div className={ "flex justify-center flex-wrap gap-3" }>
			{ guessBlocks.map( ( guessBlockForWord, idx ) => (
				<div className="grid gap-1" role="grid" key={ `guessBlock${ idx }` }>
					{ guessBlockForWord.map( ( guessBlock, i ) => (
						<div className={ "grid grid-cols-5 gap-1" } key={ i }>
							{ guessBlock.map( ( { letter, state }, index ) => (
								<div
									key={ index }
									className={ cn(
										isInvalidGuess( i ) ? "border-red-500" : "border-gray-400",
										getBlockColor( state ),
										"w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 border rounded",
										"flex items-center justify-center"
									) }
								>
									<p className={ "text-lg sm:text-xl md:text-2xl font-semibold" }>
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
	const guessBlocks = useStore( store, state => state.game.guessBlocks );
	const gameId = useStore( store, state => state.game.id );
	const { data, isPending } = useGetWordsQuery( gameId );

	if ( isPending || !data ) {
		return <Spinner/>;
	}

	return (
		<div className={ "flex justify-center flex-wrap gap-5" }>
			{ guessBlocks.map( ( guessBlockForWord, idx ) => (
				<div className="grid gap-0.5 text-center" role="grid" key={ `guessBlock${ idx }` }>
					{ guessBlockForWord.map( ( guessBlock, i ) => (
						<div className={ "grid grid-cols-5 gap-0.5" } key={ i }>
							{ guessBlock.map( ( { state }, index ) => (
								<div
									key={ index }
									className={ cn(
										getBlockColor( state ),
										"w-5 h-5 md:h-8 md:w-8 rounded",
										"flex items-center justify-center"
									) }
								/>
							) ) }
						</div>
					) ) }
					<h2 className={ "font-semibold text-lg" }>{ data.words[ idx ].toUpperCase() }</h2>
				</div>
			) ) }
		</div>
	);
}
