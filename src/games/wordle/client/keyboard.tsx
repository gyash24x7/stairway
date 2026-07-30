import { Spinner } from "@/shared/ui/primitives/spinner";
import { cn } from "@/shared/ui/utils/cn";
import { DeleteIcon, LogOutIcon } from "lucide-react";
import { useWordle } from "./context";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

function getAvailableLetters( guesses: ReadonlyArray<string> ): string[] {
	let letters = "abcdefghijklmnopqrstuvwxyz".split( "" );
	for ( const guess of guesses ) {
		for ( const letter of guess.toLowerCase().split( "" ) ) {
			letters = letters.filter( ( l ) => l !== letter );
		}
	}
	return letters;
}

function KeyboardKey( { letter }: { letter: string } ) {
	const {
		data,
		isPending,
		handleKeyPress,
		handleBackspace,
		handleSubmit
	} = useWordle();
	const availableLetters = getAvailableLetters( data.view.guesses );
	const isLetterAvailable = letter.length !== 1 || availableLetters.includes( letter );

	if ( letter === "enter" ) {
		return (
			<button
				onClick={ handleSubmit }
				className={ cn(
					"p-2 rounded bg-green-500 text-center text-sm font-medium",
					"transition-all duration-100 ease-in-out col-span-2 cursor-pointer"
				) }
				disabled={ isPending }
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
				isLetterAvailable
					? "bg-accent text-neutral-dark"
					: "bg-background text-foreground"
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
