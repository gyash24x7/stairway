import { EnterIcon, ResetIcon } from "@radix-ui/react-icons";
import { client } from "@stairway/clients/wordle";
import { useMutation } from "@tanstack/react-query";
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
import { useMemo } from "react";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

export function KeyboardKey( { letter }: { letter: string } ) {
	const updateCurrentGuess = useUpdateCurrentGuess();
	const backspaceCurrentGuess = useBackspaceCurrentGuess();
	const availableLetters = useAvailableLetters();
	const isValidWord = useIsValidWord();
	const gameId = useGameId();
	const currentGuess = useCurrentGuess();
	const resetCurrentGuess = useResetCurrentGuess();
	const updateGameData = useUpdateGameData();

	const isLetterAvailable = useMemo(
		() => letter.length !== 1 || availableLetters.includes( letter ),
		[ letter, availableLetters ]
	);

	const { mutate, isPending } = useMutation( {
		mutationFn: client.makeGuess.mutate,
		onSuccess: ( data ) => {
			updateGameData( data );
			resetCurrentGuess();
		}
	} );

	if ( letter === "enter" ) {
		return (
			<button
				onClick={ () => mutate( { gameId, guess: currentGuess.join( "" ) } ) }
				className={ "w-12 h-12 flex justify-center items-center rounded-md bg-green cursor-pointer" }
				disabled={ !isValidWord || isPending }
			>
				<EnterIcon className={ "w-8 h-8" }/>
			</button>
		);
	}

	if ( letter === "back" ) {
		return (
			<button
				className={ "w-12 h-12 flex justify-center items-center rounded-md bg-amber cursor-pointer" }
				onClick={ () => backspaceCurrentGuess() }
			>
				<ResetIcon className={ "w-8 h-8" }/>
			</button>
		);
	}


	return (
		<button
			className={ "w-12 h-12 flex justify-center items-center rounded-md cursor-pointer" }
			onClick={ () => updateCurrentGuess( letter ) }
			style={ { backgroundColor: isLetterAvailable ? "#808080" : "#333333" } }
		>
			<p className={ "text-white text-lg" }>{ letter.toUpperCase() }</p>
		</button>
	);
}

export function Keyboard() {
	return (
		<div className={ "flex flex-col gap-3 items-center" }>
			{ LINES.map( ( line ) => (
				<div className={ "flex gap-3" } key={ line.join( "" ) }>
					{ line.map( ( letter ) => <KeyboardKey letter={ letter } key={ letter }/> ) }
				</div>
			) ) }
		</div>
	);
}