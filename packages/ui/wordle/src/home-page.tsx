import { useAuth } from "@s2h-ui/auth/context";
import { Separator } from "@s2h-ui/primitives/separator";
import { cn } from "@s2h-ui/primitives/utils";
import { CreateGame } from "./create-game";

export function WordleHomePage() {
	const { isLoggedIn } = useAuth();
	return (
		<div className={ "flex gap-5 flex-col mt-2" }>
			<h2 className={ cn( "text-4xl font-heading" ) }>WORDLE</h2>
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
				{ isLoggedIn ? <CreateGame/> : <h2 className={ "text-2xl font-semibold" }>Login to Play!</h2> }
			</div>
			<Separator/>
		</div>
	);
}