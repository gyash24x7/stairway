import { CreateGame } from "@/ui/components/create-game";
import { createTicTacToeGameFn } from "./client";

export function TicTacToeCreateGame() {
	// Tic-Tac-Toe is a fixed two-seat game; it starts once both seats are filled
	// (a second player joins, or bots are added), so `autoStart` stays on.
	const createTicTacToeGame = async (): Promise<string> => {
		const { id } = await createTicTacToeGameFn( {
			playerCount: 2,
			autoStart: true
		} );
		return id;
	};

	return (
		<CreateGame
			game={ "tic-tac-toe" }
			createGame={ createTicTacToeGame }
		/>
	);
}
