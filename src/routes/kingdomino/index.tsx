import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { KingdominoHomePage } from "@/games/kingdomino/client/home-page.tsx";

export const Route = createFileRoute( "/kingdomino/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <KingdominoHomePage isLoggedIn={ !!authInfo }/>;
}
