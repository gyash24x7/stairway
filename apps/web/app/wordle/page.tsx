import { getAuthInfo } from "@/utils/actions.ts";
import { Separator } from "@stairway/components/base";
import { CreateGame } from "@stairway/components/wordle";

export default async function WordleHomePage() {
	const authInfo = await getAuthInfo();

	return (
		<div className={ "flex gap-5 flex-col mt-2" }>
			<h2 className={ "text-4xl font-fjalla" }>WORDLE</h2>
			<p>
				Wordle is word game where players have six attempts to guess a
				five-letter word, with feedback given for each guess in the form of
				coloured tiles indicating when letters match or occupy the correct
				position.
			</p>
			<p>
				There are many variations to it. You can customize to guess multiple
				words as part of a single game.
			</p>
			<Separator/>
			<div>
				{ !authInfo && <h2 className={ "text-2xl font-semibold" }>Login to Play!</h2> }
				{ !!authInfo && <CreateGame/> }
			</div>
		</div>
	);
}