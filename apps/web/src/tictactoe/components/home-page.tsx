import { client } from "@/api/client";
import { CreateGame } from "@/shared/components/create-game";
import { JoinGame } from "@/shared/components/join-game";
import { useAuth } from "@/shared/hooks/use-auth";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@s2h/shared/utils/cn";

export function TicTacToeHomePage() {
	const { authInfo } = useAuth();
	return (
		<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
			<h2 className={ cn( "text-4xl font-heading" ) }>TIC TAC TOE</h2>
			<p>
				Tic Tac Toe, also called Noughts and Crosses or Xs and Os, is a
				classic two-player paper-and-pencil game played on a 3×3 grid.
				Players take turns marking empty squares, the first with X and the
				second with O, racing to be the first to line up three of their
				marks horizontally, vertically, or diagonally.
			</p>
			<p>
				It is one of the simplest strategy games and a common introduction to
				combinatorial game theory. With perfect play from both sides, every
				game ends in a draw.
			</p>
			<Separator/>
			{ !!authInfo
				? (
					<div className={ "grid grid-cols-1 md:grid-cols-2 gap-5 w-full" }>
						<CreateGame
							game={ "tic-tac-toe" }
							createGame={ () => client.tictactoe.createGame() }
						/>
						<JoinGame
							game={ "tic-tac-toe" }
							joinGame={ input => client.tictactoe.joinGame( input ) }
						/>
					</div>
				)
				: (
					<div className={ "flex gap-5 w-full" }>
						<div className={ "text-lg text-center" }>Please log in to play.</div>
					</div>
				)
			}
			<Separator/>
			<h2 className={ "text-xl font-semibold" }>RULES</h2>
			<p className={ "mb-5" }>
				The game is played on a 3×3 grid of nine empty cells. Two players
				are assigned opposing marks: one plays X and the other plays O. By
				convention, X moves first.
			</p>
			<p className={ "mb-5" }>
				On their turn, a player places their mark in any empty cell. Marks
				cannot be moved or replaced once placed. Play alternates between the
				two players until the game ends.
			</p>
			<p className={ "mb-5" }>
				The objective is to be the first player to place three of their own
				marks in a straight line. A line may run:
			</p>
			<div className={ "pl-2 mb-3" }>
				<p className={ "mb-2" }>Horizontally across any of the three rows</p>
				<p className={ "mb-2" }>Vertically down any of the three columns</p>
				<p className={ "mb-2" }>
					Diagonally from corner to corner (either direction)
				</p>
			</div>
			<p className={ "mb-5" }>
				As soon as a player completes a line of three, that player wins the
				game and play stops. If all nine cells are filled and no line of
				three has been formed, the game ends in a draw (also called a "cat's
				game").
			</p>
			<p className={ "mb-5" }>
				Despite its simplicity, Tic Tac Toe rewards forward thinking. Strong
				players look for "forks" — moves that create two threats of three in
				a row at once, forcing the opponent to block one and concede the
				other. Conversely, defensive play focuses on blocking the opponent's
				lines and avoiding positions where a fork can be created against
				you.
			</p>
			<p className={ "mb-5" }>
				With optimal play from both sides, Tic Tac Toe is a solved game and
				always ends in a draw. The opening move into the center or a corner
				is generally considered the strongest, while opening on an edge gives
				the opponent the most room to force a draw or win.
			</p>
		</div>
	);
}