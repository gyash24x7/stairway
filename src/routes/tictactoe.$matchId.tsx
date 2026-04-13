import { TicTacToeProvider } from "@/tictactoe/components/context";
import { GameView } from "@/tictactoe/components/game-view";
import { getMatch } from "@/tictactoe/core/actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/tictactoe/$matchId" )( {
	loader: ( { params } ) => getMatch( { data: { matchId: params.matchId } } ),
	component: () => {
		const data = Route.useLoaderData();

		return (
			<TicTacToeProvider data={ data }>
				<GameView/>
			</TicTacToeProvider>
		);
	}
} );
