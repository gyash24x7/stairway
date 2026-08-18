import { tictactoeApi } from "@/games/tictactoe/client/client.ts";
import { CreateGame } from "@/swish/client/create-game.tsx";
import { GameHomePage } from "@/swish/client/game-home-page.tsx";

export function TicTacToeHomePage( props: { isLoggedIn?: boolean } ) {
	return (
		<GameHomePage
			game={ "tictactoe" }
			title={ "TIC TAC TOE" }
			isLoggedIn={ props.isLoggedIn }
			createGame={ <CreateGame game={ "tictactoe" } createGame={ tictactoeApi.createGame }/> }
			joinGame={ tictactoeApi.join }
			blurb={
				<>
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
				</>
			}
			rules={
				<>
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
				</>
			}
		/>
	);
}
