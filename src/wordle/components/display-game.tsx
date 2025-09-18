"use client";

import { cn } from "@/shared/utils/cn";
import { GameCompleted } from "@/wordle/components/game-completed";
import { GuessBlocks } from "@/wordle/components/guess-blocks";
import { Keyboard } from "@/wordle/components/keyboard";
import { store } from "@/wordle/components/store";
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

	return <GameCompleted/>;
}