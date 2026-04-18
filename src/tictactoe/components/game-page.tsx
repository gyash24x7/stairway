import { TicTacToeProvider } from "@/tictactoe/components/context";
import { GameView } from "@/tictactoe/components/game-view";
import { getGame } from "@/tictactoe/core/actions";

export async function TicTacToeGamePage( { params }: { params: { gameId: string } } ) {
	const data = await getGame( { gameId: params.gameId } );
	return (
		<TicTacToeProvider data={ data }>
			<GameView/>
		</TicTacToeProvider>
	);
}