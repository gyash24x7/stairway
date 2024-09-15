"use client";

import { EnterIcon, ResetIcon } from "@radix-ui/react-icons";
import { useMemo } from "react";
import { useServerAction } from "zsa-react";
import { makeGuessAction } from "../actions";
import {
	useAvailableLetters,
	useBackspaceCurrentGuess,
	useCurrentGuess,
	useGameId,
	useIsValidWord,
	useResetCurrentGuess,
	useUpdateCurrentGuess,
	useUpdateGameData
} from "../store";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

export function KeyboardKey( { letter }: { letter: string } ) {
	const gameId = useGameId();
	const currentGuess = useCurrentGuess();
	const updateCurrentGuess = useUpdateCurrentGuess();
	const backspaceCurrentGuess = useBackspaceCurrentGuess();
	const resetCurrentGuess = useResetCurrentGuess();
	const updateGameData = useUpdateGameData();
	const availableLetters = useAvailableLetters();
	const isValidWord = useIsValidWord();

	const isLetterAvailable = useMemo(
		() => letter.length !== 1 || availableLetters.includes( letter ),
		[ letter, availableLetters ]
	);

	const { execute } = useServerAction( makeGuessAction, {
		onSuccess: ( { data } ) => updateGameData( data ),
		onFinish: () => resetCurrentGuess()
	} );

	if ( letter === "enter" ) {
		return (
			<div
				className={ "w-12 h-12 flex justify-center items-center rounded-md bg-green cursor-pointer" }
				onClick={ async () => {
					if ( isValidWord ) {
						await execute( { gameId, guess: currentGuess.join( "" ) } );
					}
				} }
			>
				<EnterIcon className={ "w-8 h-8" }/>
			</div>
		);
	}

	if ( letter === "back" ) {
		return (
			<div
				className={ "w-12 h-12 flex justify-center items-center rounded-md bg-amber cursor-pointer" }
				onClick={ () => backspaceCurrentGuess() }
			>
				<ResetIcon className={ "w-8 h-8" }/>
			</div>
		);
	}


	return (
		<div
			className={ "w-12 h-12 flex justify-center items-center rounded-md cursor-pointer" }
			onClick={ () => updateCurrentGuess( letter ) }
			style={ { backgroundColor: isLetterAvailable ? "#808080" : "#333333" } }
		>
			<p className={ "text-white text-lg" }>{ letter.toUpperCase() }</p>
		</div>
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