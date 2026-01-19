import { cn } from "@s2h-ui/primitives/utils";
import { GameInfo } from "@s2h-ui/shared/game-info";
import { useStore } from "@tanstack/react-store";
import { CreateGame } from "./create-game.tsx";
import { GuessBlocks, GuessDiagramBlocks } from "./guess-blocks.tsx";
import { Keyboard } from "./keyboard.tsx";
import { store } from "./store.tsx";

export function GameView() {
	const completed = useStore( store, state => state.game.completed );

	return (
		<div className={ `flex flex-col gap-3 items-center mb-40 max-w-6xl w-full justify-self-center` }>
			<GameInfo name={ "wordle" }/>
			<div className={ "flex flex-col items-center w-full max-w-xl bg-background rounded-md p-2 md:p-4" }>
				{ !completed ? <GuessBlocks/> : <GuessDiagramBlocks/> }
				<div
					className={ cn(
						"fixed left-0 right-0 bottom-0 bg-surface",
						"flex flex-col gap-2 p-3 items-center"
					) }
				>
					{ completed && <div>TRY AGAIN?</div> }
					{ !completed ? <Keyboard/> : <CreateGame/> }
				</div>
			</div>
		</div>
	);
}