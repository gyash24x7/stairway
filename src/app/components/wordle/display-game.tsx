"use client";

import { GuessBlocks, GuessDiagramBlocks } from "@/app/components/wordle/guess-blocks";
import { Keyboard } from "@/app/components/wordle/keyboard";
import { store } from "@/app/components/wordle/store";
import { cn } from "@/utils/cn";
import { useStore } from "@tanstack/react-store";

export function DisplayGame() {
	const completed = useStore( store, state => state.game.completed );
	if ( !completed ) {
		return (
			<div className={ "flex flex-col gap-12 items-center w-full" }>
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
		);
	}

	return (
		<div className={ "flex flex-col gap-12 items-center w-full" }>
			<h1 className={ "text-4xl font-fjalla text-green-600" }>Game Completed</h1>
			<GuessDiagramBlocks/>
			<div
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
					"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center bg-main"
				) }
			>
				<a href={ "/core" }>
					<h2>TRY AGAIN?</h2>
				</a>
			</div>
		</div>
	);
}