import { useAuth } from "@/auth/components/context";
import { CreateGame } from "@/shared/components/create-game";
import { JoinGame } from "@/shared/components/join-game";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@/shared/utils/cn";
import { createGame, joinGame } from "@/tictactoe/core/actions";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute( "/tictactoe/" )( {
	component: () => {
		const { authInfo } = useAuth();
		const createGameFn = useServerFn( createGame );
		const joinGameFn = useServerFn( joinGame );

		return (
			<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
				<h2 className={ cn( "text-4xl font-heading" ) }>TIC TAC TOE</h2>
				<p>
					Wordle is word game where players have six attempts to guess a
					five-letter word, with feedback given for each guess in the form of
					coloured tiles indicating when letters game or occupy the correct
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
							<CreateGame game={ "tictactoe" } createGame={ createGameFn }/>
							<JoinGame game={ "tictactoe" } joinGame={ joinGameFn }/>
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
