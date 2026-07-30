import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { TicTacToeHomePage } from "@/games/tictactoe/client/index.ts";

export const Route = createFileRoute( "/tictactoe/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <TicTacToeHomePage isLoggedIn={ !!authInfo }/>;
}
