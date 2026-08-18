import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { TicTacToeGamePage } from "@/games/tictactoe/client/game-page.tsx";

export const Route = createFileRoute( "/tictactoe/$gameId" )( {
	component: GameRoute
} );

function GameRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<TicTacToeGamePage gameId={ gameId }/>
		</RequireSession>
	);
}
