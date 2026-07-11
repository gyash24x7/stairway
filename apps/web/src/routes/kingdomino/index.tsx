import { useAuth } from "@s2h-ui/auth/use-auth";
import { KingdominoHomePage } from "@s2h-ui/kingdomino";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/kingdomino/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <KingdominoHomePage isLoggedIn={ !!authInfo }/>;
}
