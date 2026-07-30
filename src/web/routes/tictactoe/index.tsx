import { useAuth } from "@/auth/client/use-auth";
import { TicTacToeHomePage } from "@/games/tictactoe/client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/tictactoe/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <TicTacToeHomePage isLoggedIn={ !!authInfo }/>;
}
