import { Separator } from "@base/ui";
import { createFileRoute } from "@tanstack/react-router";
import { CreateGame } from "@wordle/ui";

export const Route = createFileRoute( "/wordle/" )( {
	component: () => {
		const { authInfo } = Route.useRouteContext();
		return (
			<div className={ "flex gap-10 flex-col mt-2" }>
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
					{ !!authInfo ? <CreateGame/> : <h2 className={ "font-fjalla" }>Login to play!</h2> }
				</div>
			</div>
		);
	}
} );
