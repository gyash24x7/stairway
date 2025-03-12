import { cn, Spinner } from "@base/components";
import { EnterIcon, ResetIcon } from "@radix-ui/react-icons";
import { wordle } from "@stairway/clients/wordle";
import {
	useAvailableLetters,
	useBackspaceCurrentGuess,
	useCurrentGuess,
	useGameId,
	useIsValidWord,
	useResetCurrentGuess,
	useUpdateCurrentGuess,
	useUpdateGameData
} from "@wordle/store";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

export function KeyboardKey( { letter }: { letter: string } ) {
	const availableLetters = useAvailableLetters();
	const isValidWord = useIsValidWord();
	const gameId = useGameId();
	const currentGuess = useCurrentGuess();
	const updateGameData = useUpdateGameData();
	const resetCurrentGuess = useResetCurrentGuess();
	const backspaceCurrentGuess = useBackspaceCurrentGuess();
	const updateCurrentGuess = useUpdateCurrentGuess();

	const isLetterAvailable = letter.length !== 1 || availableLetters.includes( letter );

	const { mutate, isPending } = wordle.useMakeGuessMutation( async ( data ) => {
		updateGameData( data );
		resetCurrentGuess();
	} );

	if ( letter === "enter" ) {
		return (
			<button
				onClick={ () => mutate( { gameId, guess: currentGuess.join( "" ) } ) }
				className={ cn(
					"p-2 rounded bg-green-500 text-center text-sm font-medium",
					"transition-all duration-100 ease-in-out col-span-2"
				) }
				disabled={ !isValidWord || isPending }
			>
				{ isPending ? <Spinner/> : <EnterIcon className={ "w-6 h-6" }/> }
			</button>
		);
	}

	if ( letter === "back" ) {
		return (
			<button
				className={ cn(
					"p-2 rounded bg-amber-500 text-center text-sm font-medium",
					"transition-all duration-100 ease-in-out col-span-2"
				) }
				onClick={ () => backspaceCurrentGuess() }
			>
				<ResetIcon className={ "w-6 h-6" }/>
			</button>
		);
	}


	return (
		<button
			className={ cn(
				"p-2 rounded bg-background text-center text-sm font-medium",
				"transition-all duration-100 ease-in-out",
				isLetterAvailable ? "bg-background" : "bg-gray-800"
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