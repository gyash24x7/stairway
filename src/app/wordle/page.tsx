import { Separator } from "@/components/base/separator";
import { CreateGame } from "@/components/wordle/create-game";
import { getAuthInfo } from "@/server/utils/auth";
import { cn } from "@/utils/cn";
import { fjalla } from "@/utils/fonts";

export default async function WordleHome() {
	const authInfo = await getAuthInfo();
	return (
		<div className={ "flex gap-5 flex-col mt-2" }>
			<h2 className={ cn( "text-4xl", fjalla.className ) }>WORDLE</h2>
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
				{ !!authInfo
					? <CreateGame/>
					: <h2 className={ "text-2xl font-semibold" }>Login to Play!</h2>
				}
			</div>
			<Separator/>
		</div>
	);
}