import { useAuth } from "@s2h-ui/auth/use-auth";
import { TicTacToeHomePage } from "@s2h-ui/tictactoe";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/tictactoe/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <TicTacToeHomePage isLoggedIn={ !!authInfo }/>;
}
