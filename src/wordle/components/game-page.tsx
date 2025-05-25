"use client";

import { cn } from "@/shared/utils/cn";
import { fjalla } from "@/shared/utils/fonts";
import { GuessBlocks, GuessDiagramBlocks } from "@/wordle/components/guess-blocks";
import { Keyboard } from "@/wordle/components/keyboard";
import { store, updateGameData } from "@/wordle/store";
import type { Wordle } from "@/wordle/types";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";

export function GamePage( props: { data: Wordle.Game } ) {
	const game = useStore( store, state => state.game );
	const isGameCompleted = ( game.words.length !== 0 && game.words.length === game.completedWords.length )
		|| game.guesses.length === ( game.words.length + game.wordLength );

	useEffect( () => {
		updateGameData( props.data );
	}, [] );

	return (
		<div className={ `flex flex-col items-center mb-20` }>
			<h1 className={ cn( "text-4xl my-3", fjalla.className ) }>WORDLE</h1>
			{ isGameCompleted && (
				<div className={ "flex flex-col gap-12 items-center" }>
					<h1 className={ "text-4xl font-fjalla text-green-600" }>Game Completed</h1>
					<GuessDiagramBlocks/>
					<div
						className={ cn(
							"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
							"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center bg-main"
						) }
					>
						<a href={ "/wordle" }>
							<h2>TRY AGAIN?</h2>
						</a>
					</div>
				</div>
			) }
			{ !isGameCompleted && (
				<div>
					<GuessBlocks/>
					<div
						className={ cn(
							"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
							"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center bg-white"
						) }
					>
						<Keyboard/>
					</div>
				</div>
			) }
		</div>
	);
}