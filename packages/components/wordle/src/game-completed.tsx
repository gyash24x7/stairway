import { cn } from "@base/components";
import { useGameWords } from "@wordle/store";
import { CreateGame } from "./create-game.tsx";
import { GuessDiagramBlocks } from "./guess-blocks.tsx";

export function GameCompleted() {
	const words = useGameWords();

	return (
		<div className={ "flex flex-col gap-12 items-center" }>
			<h1 className={ "text-4xl font-fjalla text-green-600" }>Game Completed</h1>
			<div className={ "grid grid-cols-2 lg:grid-cols-4 gap-5 mb-48" }>
				{ words.map( word => <GuessDiagramBlocks word={ word } key={ word }/> ) }
			</div>
			<div
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
					"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
				) }
			>
				<h2>TRY AGAIN?</h2>
				<CreateGame/>
			</div>
		</div>
	);
}