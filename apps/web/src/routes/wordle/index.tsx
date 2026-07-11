import { useAuth } from "@s2h-ui/auth/use-auth";
import { WordleHomePage } from "@s2h-ui/wordle";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/wordle/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <WordleHomePage isLoggedIn={ !!authInfo }/>;
}
