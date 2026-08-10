import { createFileRoute } from "@tanstack/react-router";

import { TicTacToeGamePage } from "@/games/tictactoe/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

export const Route = createFileRoute( "/tictactoe/$gameId/" )( {
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
