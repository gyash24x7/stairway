import { useGameWords, useGuessBlockMap } from "../store";
import { GuessBlocks } from "./guess-blocks.tsx";
import { Keyboard } from "./keyboard.tsx";

export function GameInProgress() {
	const words = useGameWords();
	const guessBlockMap = useGuessBlockMap();
	return (
		<div>
			<div className={ "flex gap-5 justify-center flex-wrap" }>
				{ words.map( word => (
					<div className={ "flex flex-col gap-3 p-2 justify-center items-center" } key={ word }>
						<GuessBlocks guessBlocks={ guessBlockMap[ word ] }/>
					</div>
				) ) }
			</div>
			<div className={ "p-5" }>
				<Keyboard/>
			</div>
		</div>
	);
}