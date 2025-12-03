import { DeleteIcon, LogOutIcon } from "@s2h-ui/primitives/icons";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { useMakeGuessMutation } from "@s2h/client/wordle";
import { dictionary } from "@s2h/wordle/dictionary";
import { useStore } from "@tanstack/react-store";
import { backspaceCurrentGuess, resetCurrentGuess, store, updateCurrentGuess } from "./store.tsx";

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

export function KeyboardKey( { letter }: { letter: string } ) {
	const { currentGuess, game } = useStore( store );
	const { mutateAsync, isPending } = useMakeGuessMutation( {
		onSuccess: ( game ) => store.setState( ( state ) => ( { ...state, game } ) ),
		onSettled: () => resetCurrentGuess()
	} );

	const availableLetters = getAvailableLetters( game.guesses );
	const isValidWord = dictionary.includes( currentGuess.join( "" ) );
	const isLetterAvailable = letter.length !== 1 || availableLetters.includes( letter );

	const handleEnter = () => mutateAsync( { gameId: game.id, guess: currentGuess.join( "" ) } );

	if ( letter === "enter" ) {
		return (
			<button
				onClick={ handleEnter }
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
				onClick={ () => backspaceCurrentGuess() }
			>
				<DeleteIcon className={ "w-6 h-6" }/>
			</button>
		);
	}


	return (
		<button
			className={ cn(
				"p-2 rounded bg-bg text-center text-sm font-medium",
				"transition-all duration-100 ease-in-out cursor-pointer",
				isLetterAvailable ? "bg-main" : "bg-gray-800"
			) }
			onClick={ () => updateCurrentGuess( letter ) }
		>
			<p className={ cn( "text-lg", !isLetterAvailable && "text-white" ) }>{ letter.toUpperCase() }</p>
		</button>
	);
}

export function Keyboard() {
	return (
		<div className={ "flex flex-col gap-2 items-center" }>
			{ LINES.map( ( line ) => (
				<div className={ "flex gap-2" } key={ line.join( "" ) }>
					{ line.map( ( letter ) => <KeyboardKey letter={ letter } key={ letter }/> ) }
				</div>
			) ) }
		</div>
	);
}