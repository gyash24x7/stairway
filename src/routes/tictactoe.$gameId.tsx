import { TicTacToeProvider } from "@/tictactoe/components/context";
import { GameView } from "@/tictactoe/components/game-view";
import { getGame } from "@/tictactoe/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/tictactoe/$gameId" )( {
	loader: ( { params } ) => getGame( { data: { gameId: params.gameId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<TicTacToeProvider data={ data }>
				<GameView/>
			</TicTacToeProvider>
		);
	}
} );
