"use client";

import { GameInfo } from "@/shared/components/game-info";
import { cn } from "@/shared/utils/cn";
import { useWordle } from "@/wordle/components/context";
import { GuessBlocks, GuessDiagramBlocks } from "@/wordle/components/guess-blocks";
import { Keyboard } from "@/wordle/components/keyboard";

export function Board() {
	const { game } = useWordle();
	const gameInProgress = game.status === "IN_PROGRESS";
	const gameCompleted = game.status === "COMPLETED";

	return (
		<div className={ "flex flex-col gap-3 items-center mb-40 max-w-6xl w-full justify-self-center" }>
			<GameInfo
				code={ game.code }
				name={ "Wordle" }
				completed={ gameCompleted }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>GUESSES</p>
						<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
							{ game.state.guesses.length + "/" + game.state.maxGuesses }
						</h2>
					</div>
				}
			/>

			{ gameCompleted
				? <GuessDiagramBlocks/>
				: <GuessBlocks/>
			}

			{ gameCompleted && (
				<p className={ cn(
					"text-xl md:text-2xl font-heading",
					game.state.victory ? "text-green-500" : "text-red-500"
				) }>
					{ game.state.victory ? "You won!" : "Better luck next time!" }
				</p>
			) }

			{ gameInProgress && <Keyboard/> }
		</div>
	);
}
