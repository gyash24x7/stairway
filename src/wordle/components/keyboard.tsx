import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useWordle } from "@/wordle/components/context";
import { dictionaries } from "@/wordle/core/dictionary";
import { DeleteIcon, LogOutIcon } from "lucide-react";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

function getAvailableLetters( guesses: string[] ): string[] {
	let letters = "abcdefghijklmnopqrstuvwxyz".split( "" );
	for ( const guess of guesses ) {
		for ( const letter of guess.toLowerCase().split( "" ) ) {
			letters = letters.filter( ( l ) => l !== letter );
		}
	}
	return letters;
}

function KeyboardKey( { letter }: { letter: string } ) {
	const { match, currentGuess, isPending, handleKeyPress, handleBackspace, handleSubmit } = useWordle();
	const availableLetters = getAvailableLetters( match.state.data.guesses );
	const isValidWord = dictionaries[ match.config.wordLength ].includes( currentGuess );
	const isLetterAvailable = letter.length !== 1 || availableLetters.includes( letter );

	if ( letter === "enter" ) {
		return (
			<button
				onClick={ handleSubmit }
				className={ cn(
					"p-2 rounded bg-green-500 text-center text-sm font-medium",
					"transition-all duration-100 ease-in-out col-span-2 cursor-pointer"
				) }
				disabled={ !isValidWord || isPending }
			>
				{ isPending ? <Spinner/> : <LogOutIcon className={ "w-6 h-6" }/> }
			</button>
		);
	}

	if ( letter === "back" ) {
		return (
			<button
				className={ cn(
					"p-2 rounded bg-amber-500 text-center text-sm font-medium",
					"transition-all duration-100 ease-in-out col-span-2 cursor-pointer"
				) }
				onClick={ handleBackspace }
			>
				<DeleteIcon className={ "w-6 h-6" }/>
			</button>
		);
	}

	return (
		<button
			className={ cn(
				"p-2 rounded bg-surface text-center text-sm font-medium",
				"transition-all duration-100 ease-in-out cursor-pointer",
				isLetterAvailable ? "bg-accent text-neutral-dark" : "bg-background text-foreground"
			) }
			onClick={ () => handleKeyPress( letter ) }
		>
			<p className={ cn( "text-lg" ) }>{ letter.toUpperCase() }</p>
		</button>
	);
}

export function Keyboard() {
	return (
		<div className={ "flex flex-col gap-2 items-center" }>
			{ LINES.map( ( line ) => (
				<div className={ "flex gap-2" } key={ line.join( "" ) }>
					{ line.map( ( letter ) => (
						<KeyboardKey letter={ letter } key={ letter }/>
					) ) }
				</div>
			) ) }
		</div>
	);
}
