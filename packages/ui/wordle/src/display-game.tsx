import { cn } from "@s2h-ui/primitives/utils";
import { useStore } from "@tanstack/react-store";
import { GameCompleted } from "./game-completed.tsx";
import { GuessBlocks } from "./guess-blocks.tsx";
import { Keyboard } from "./keyboard.tsx";
import { store } from "./store.tsx";

export function DisplayGame() {
	const completed = useStore( store, state => state.game.completed );
	if ( !completed ) {
		return (
			<div className={ "flex flex-col gap-12 items-center w-full" }>
				<GuessBlocks/>
				<div
					className={ cn(
						"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
						"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center bg-secondary-background"
					) }
				>
					<Keyboard/>
				</div>
			</div>
		);
	}

	return <GameCompleted/>;
}