"use client";

import { Spinner } from "@/components/base/spinner";
import { dictionary } from "@/libs/words/dictionary";
import { getAvailableLetters } from "@/libs/words/utils";
import { makeGuess } from "@/server/wordle/functions";
import { backspaceCurrentGuess, resetCurrentGuess, store, updateCurrentGuess, updateGameData } from "@/stores/wordle";
import { cn } from "@/utils/cn";
import { EnterIcon, ResetIcon } from "@radix-ui/react-icons";
import { useStore } from "@tanstack/react-store";
import { useTransition } from "react";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

export function KeyboardKey( { letter }: { letter: string } ) {
	const [ isPending, startTransition ] = useTransition();
	const { currentGuess, game } = useStore( store );

	const availableLetters = getAvailableLetters( game.guesses );
	const isValidWord = dictionary.includes( currentGuess.join( "" ) );
	const isLetterAvailable = letter.length !== 1 || availableLetters.includes( letter );

	const handleEnter = () => startTransition( async () => {
		const updatedGame = await makeGuess( { gameId: game.id, guess: currentGuess.join( "" ) } );
		updateGameData( updatedGame );
		resetCurrentGuess();
	} );

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
				{ isPending ? <Spinner/> : <EnterIcon className={ "w-6 h-6" }/> }
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
				<ResetIcon className={ "w-6 h-6" }/>
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