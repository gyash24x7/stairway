import { useAuth } from "@/auth/components/context";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@/shared/utils/cn";
import { WordleCreateGame } from "@/wordle/components/create-game";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/wordle/" )( {
	component: () => {
		const { authInfo } = useAuth();

		return (
			<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
				<h2 className={ cn( "text-4xl font-heading" ) }>TIC TAC TOE</h2>
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
				{ !!authInfo
					? (
						<div className={ "flex gap-5 justify-self-center w-full" }>
							<WordleCreateGame/>
						</div>
					)
					: (
						<div className={ "flex gap-5 justify-self-center w-full" }>
							<div className={ "text-lg text-center" }>Please log in to play.</div>
						</div>
					)
				}
				<Separator/>
			</div>
		);
	}
} );
