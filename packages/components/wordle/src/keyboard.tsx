"use client";

import { observer } from "@legendapp/state/react";
import { EnterIcon, ResetIcon } from "@radix-ui/react-icons";
import { makeGuess } from "@stairway/api/wordle";
import { cn, Spinner } from "@stairway/components/base";
import { useAvailableLetters, useCurrentGuess, useGameId, useIsValidWord, wordle$ } from "@stairway/stores/wordle";
import { useMemo, useTransition } from "react";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

export const KeyboardKey = observer( ( { letter }: { letter: string } ) => {
	const [ isPending, startTransition ] = useTransition();
	const availableLetters = useAvailableLetters();
	const isValidWord = useIsValidWord();
	const gameId = useGameId();
	const currentGuess = useCurrentGuess();

	const isLetterAvailable = useMemo(
		() => letter.length !== 1 || availableLetters.includes( letter ),
		[ letter, availableLetters ]
	);

	const makeGuessFn = () => {
		startTransition( async () => {
			const data = await makeGuess( { gameId, guess: currentGuess.join( "" ) } );
			wordle$.updateGameData( data );
			wordle$.resetCurrentGuess();
		} );
	};

	if ( letter === "enter" ) {
		return (
			<button
				onClick={ makeGuessFn }
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
				onClick={ () => wordle$.backspaceCurrentGuess() }
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
			onClick={ () => wordle$.updateCurrentGuess( letter ) }
		>
			<p className={ cn( "text-lg", !isLetterAvailable && "text-white" ) }>{ letter.toUpperCase() }</p>
		</button>
	);
} );

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