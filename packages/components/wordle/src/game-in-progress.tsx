import { cn } from "@base/components";
import { useGameWords } from "@wordle/store";
import { GuessBlocks } from "./guess-blocks.tsx";
import { Keyboard } from "./keyboard.tsx";

export function GameInProgress() {
	const words = useGameWords();
	return (
		<div>
			<div className={ "grid grid-cols-2 lg:grid-cols-4 gap-5 mb-48" }>
				{ words.map( word => <GuessBlocks word={ word } key={ word }/> ) }
			</div>
			<div
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-muted border-t-4 shadow-sm",
					"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
				) }
			>
				<Keyboard/>
			</div>
		</div>
	);
}