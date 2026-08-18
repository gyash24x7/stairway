"use client";

import { CornerDownLeftIcon, DeleteIcon } from "lucide-react";

import { useWordle } from "@/games/wordle/client/context.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

const LINES = [
	[ "q", "w", "e", "r", "t", "y", "u", "i", "o", "p" ],
	[ "a", "s", "d", "f", "g", "h", "j", "k", "l" ],
	[ "enter", "z", "x", "c", "v", "b", "n", "m", "back" ]
];

/**
 * The letters this seat has not spent yet.
 *
 * Deliberately not per-letter colouring: every seat races *several* words at
 * once, so one letter can be `correct` against one word and `absent` against
 * another, and a single colour would have to lie about one of them. What is
 * unambiguous is whether a letter has been tried at all, which is what the
 * board's own tiles then qualify.
 *
 * @param guesses - The seat's guesses so far.
 * @returns The letters that appear in none of them.
 */
function availableLetters( guesses: ReadonlyArray<string> ) {
	const spent = new Set( guesses.flatMap( guess => [ ...guess.toLowerCase() ] ) );
	return "abcdefghijklmnopqrstuvwxyz".split( "" ).filter( letter => !spent.has( letter ) );
}

function KeyboardKey( { letter, available }: { letter: string; available: boolean } ) {
	const { isPending, handleKeyPress, handleBackspace, handleSubmit } = useWordle();

	if ( letter === "enter" ) {
		return (
			<button
				onClick={ handleSubmit }
				disabled={ isPending }
				className={ cn(
					"px-3 py-2 rounded bg-green-500 text-white cursor-pointer",
					"flex items-center justify-center transition-all duration-100"
				) }
			>
				{ isPending ? <Spinner/> : <CornerDownLeftIcon className={ "w-5 h-5" }/> }
			</button>
		);
	}

	if ( letter === "back" ) {
		return (
			<button
				onClick={ handleBackspace }
				className={ cn(
					"px-3 py-2 rounded bg-amber-500 text-white cursor-pointer",
					"flex items-center justify-center transition-all duration-100"
				) }
			>
				<DeleteIcon className={ "w-5 h-5" }/>
			</button>
		);
	}

	return (
		<button
			onClick={ () => handleKeyPress( letter ) }
			className={ cn(
				"w-7 md:w-9 py-2 rounded text-center cursor-pointer",
				"transition-all duration-100 ease-in-out",
				available ? "bg-accent text-neutral-dark" : "bg-background text-muted-foreground"
			) }
		>
			<span className={ "text-base md:text-lg font-semibold" }>{ letter.toUpperCase() }</span>
		</button>
	);
}

export function Keyboard() {
	const { board } = useWordle();
	const available = new Set( availableLetters( board.guesses ) );

	return (
		<div className={ "flex flex-col gap-1.5 md:gap-2 items-center" }>
			{ LINES.map( line => (
				<div className={ "flex gap-1 md:gap-1.5" } key={ line.join( "" ) }>
					{ line.map( letter => (
						<KeyboardKey
							key={ letter }
							letter={ letter }
							available={ letter.length !== 1 || available.has( letter ) }
						/>
					) ) }
				</div>
			) ) }
		</div>
	);
}
