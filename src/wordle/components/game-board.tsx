"use client";

import { GameInfo } from "@/shared/components/game-info";
import { cn } from "@/shared/utils/cn";
import { useWordle } from "@/wordle/components/context";
import { WordleCreateGame as CreateGame } from "@/wordle/components/create-game";
import { GuessBlocks, GuessDiagramBlocks } from "@/wordle/components/guess-blocks";
import { Keyboard } from "@/wordle/components/keyboard";

export function GameBoard() {
	const { match } = useWordle();
	const matchInProgress = match.status === "IN_PROGRESS";
	const matchCompleted = match.status === "COMPLETED";

	return (
		<div className={ "flex flex-col gap-3 items-center mb-40 max-w-6xl w-full justify-self-center" }>
			<GameInfo
				code={ match.code }
				name={ "Wordle" }
				completed={ matchCompleted }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>GUESSES</p>
						<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
							{ match.state.data.guesses.length + "/" + match.state.data.maxGuesses }
						</h2>
					</div>
				}
			/>

			{ matchCompleted
				? <GuessDiagramBlocks/>
				: <GuessBlocks/>
			}

			{ matchCompleted && (
				<p className={ cn(
					"text-xl md:text-2xl font-heading",
					match.result?.victory ? "text-green-500" : "text-red-500"
				) }>
					{ match.result?.victory ? "You won!" : "Better luck next time!" }
				</p>
			) }

			{ matchCompleted && <CreateGame/> }

			{ matchInProgress && <Keyboard/> }
		</div>
	);
}
