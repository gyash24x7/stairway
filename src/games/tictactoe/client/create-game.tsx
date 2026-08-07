import { CreateGame } from "@/shared/ui/components/create-game.tsx";
import { createTicTacToeGameFn } from "@/games/tictactoe/client/client.ts";

export function TicTacToeCreateGame() {
	// Tic-Tac-Toe has nothing to configure: the two seats and `autoStart` are
	// fixed server-side, so create takes an empty body.
	const createTicTacToeGame = async () => {
		const { id } = await createTicTacToeGameFn();
		return id;
	};

	return (
		<CreateGame
			game={ "tic-tac-toe" }
			createGame={ createTicTacToeGame }
		/>
	);
}
