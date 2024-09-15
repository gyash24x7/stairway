import { Separator } from "@base/ui";
import { CreateGame } from "@literature/ui";

export default function WordleHomePage() {
	return (
		<div className={ "flex gap-10 flex-col mt-2" }>
			<p>
				Wordle is word game where players have six attempts to guess a five-letter word, with feedback given
				for each guess in the form of coloured tiles indicating when letters match or occupy the correct
				position.
			</p>
			<p>
				There are many variations to it. You can customize to guess multiple words as part of a single game.
			</p>
			<Separator/>
			<div>
				<CreateGame/>
			</div>
		</div>
	);
}