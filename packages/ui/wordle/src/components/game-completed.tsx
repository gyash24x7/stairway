import { useGameWords, useGuessBlockMap } from "../store";
import { CreateGame } from "./create-game.tsx";
import { GuessDiagramBlocks } from "./guess-blocks.tsx";

export function GameCompleted() {
	const words = useGameWords();
	const guessBlockMap = useGuessBlockMap();

	return (
		<div className={ "flex flex-col gap-12 items-center" }>
			<h1 className={ "text-4xl font-fjalla" }>Game Completed</h1>
			<div className={ "flex gap-5 justify-center flex-wrap" }>
				{ words.map( word => (
					<div className={ "flex flex-col gap-3 justify-center items-center" } key={ word }>
						<GuessDiagramBlocks guessBlocks={ guessBlockMap[ word ] }/>
						<h2>{ word.toUpperCase() }</h2>
					</div>
				) ) }
			</div>
			<div className={ "flex flex-col gap-3 justify-center items-center" }>
				<h2>TRY AGAIN?</h2>
				<CreateGame/>
			</div>
		</div>
	);
}